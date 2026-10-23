import { Injectable, Logger, OnModuleInit, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import {
  UserRole,
  GrantAccessStatus,
  normalizeLocale,
  type IDashboardSessionUser,
  type SupportedLocale,
} from '@zalobot/contracts';
import { RedisService } from '../redis/redis.service';
import { ZcaService, type AvailableThread } from '../zca/zca.service';
import { DASHBOARD_OWNER_USER_ID } from './dashboard-owner';

// Lives in its own file so modules can use it without importing this service (and ZCA).
export { DASHBOARD_OWNER_USER_ID };

const DASHBOARD_OWNER_NAME = 'Chủ hệ thống';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly cooldownSeconds = 2;

  // In-memory cache for ultra-fast, zero-latency synchronous checks
  private allowedUserIdsCache: Set<string> = new Set();
  private adminUserIdsCache: Set<string> = new Set();

  // In-memory timestamp tracker for cooldown
  private lastRequestTimes: Map<string, number> = new Map();

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Optional() private readonly redisService?: RedisService,
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ZcaService,
    @Optional()
    @InjectRepository(DebtContactEntity)
    private readonly contactRepo?: Repository<DebtContactEntity>,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.refreshMemoryCache();
    if (
      this.redisService &&
      typeof (this.redisService as unknown as { onReady?: (cb: () => Promise<void>) => void })
        .onReady === 'function'
    ) {
      (this.redisService as unknown as { onReady: (cb: () => Promise<void>) => void }).onReady(
        async () => {
          await this.refreshMemoryCache();
        },
      );
    }
  }

  public async refreshMemoryCache(): Promise<void> {
    try {
      // Admins come only from the DB (first-admin bootstrap or dashboard) plus the bot's own ZCA account.
      const ownId = this.zcaService?.getOwnId();
      if (ownId) {
        let u = await this.userRepo.findOne({ where: { id: ownId } });
        if (!u) {
          u = this.userRepo.create({
            id: ownId,
            role: UserRole.ADMIN,
            grantAccess: GrantAccessStatus.GRANTED,
            createdAt: new Date(),
          });
          await this.userRepo.save(u);
        } else if (u.role !== UserRole.ADMIN || u.grantAccess !== GrantAccessStatus.GRANTED) {
          u.role = UserRole.ADMIN;
          u.grantAccess = GrantAccessStatus.GRANTED;
          await this.userRepo.save(u);
        }
      }

      const users = await this.userRepo.find();
      this.allowedUserIdsCache.clear();
      this.adminUserIdsCache.clear();

      for (const u of users) {
        const isAdmin = u.role === UserRole.ADMIN || u.id === ownId;
        const isAllowed = isAdmin || u.grantAccess === GrantAccessStatus.GRANTED;

        if (isAdmin) {
          this.adminUserIdsCache.add(u.id);
        }
        if (isAllowed) {
          this.allowedUserIdsCache.add(u.id);
          void this.redisService?.setWhitelist(u.id, true);
        } else {
          void this.redisService?.setWhitelist(u.id, false);
        }
      }

      this.logger.log(
        `PostgreSQL initialized with ${users.length} registered users (Admins: ${this.adminUserIdsCache.size}, Whitelisted: ${this.allowedUserIdsCache.size}).`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error refreshing memory cache: ${error.message}`);
    }
  }

  /**
   * Check if the system has any configured admin or whitelisted user
   */
  public async hasAnyAdminOrWhitelistedUser(): Promise<boolean> {
    if (this.adminUserIdsCache.size > 0 || this.allowedUserIdsCache.size > 0) {
      return true;
    }
    const count = await this.userRepo.count({
      where: [{ role: UserRole.ADMIN }, { grantAccess: GrantAccessStatus.GRANTED }],
    });
    return count > 0;
  }

  /**
   * Bootstrap the first user interacting with the bot as system admin
   */
  public async bootstrapFirstAdmin(
    userId: string | number,
    firstName?: string,
  ): Promise<UserEntity> {
    const user = await this.saveAsAdmin(userId.toString(), firstName);
    this.logger.log(`🎉 User ${user.id} (${firstName || 'User'}) bootstrapped as FIRST admin!`);
    return user;
  }

  /**
   * The account behind `DASHBOARD_LOGIN_CODE`. It is (re)made an admin on every sign-in, so the
   * env holder always gets back in — even with no other admin or with ZCA logged out.
   */
  public async ensureDashboardOwner(): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { id: DASHBOARD_OWNER_USER_ID } });
    return this.saveAsAdmin(
      DASHBOARD_OWNER_USER_ID,
      existing?.firstName ? undefined : DASHBOARD_OWNER_NAME,
    );
  }

  private async saveAsAdmin(strId: string, firstName?: string): Promise<UserEntity> {
    let user = await this.userRepo.findOne({ where: { id: strId } });
    if (!user) {
      user = this.userRepo.create({
        id: strId,
        role: UserRole.ADMIN,
        grantAccess: GrantAccessStatus.GRANTED,
        firstName: firstName || undefined,
        createdAt: new Date(),
      });
    } else {
      user.role = UserRole.ADMIN;
      user.grantAccess = GrantAccessStatus.GRANTED;
      if (firstName) user.firstName = firstName;
    }
    await this.userRepo.save(user);

    this.adminUserIdsCache.add(strId);
    this.allowedUserIdsCache.add(strId);
    void this.redisService?.setWhitelist(strId, true);
    return user;
  }

  public hasAdminConfigured(): boolean {
    return this.adminUserIdsCache.size > 0;
  }

  /**
   * Get all admin users in the system (from DB role=ADMIN and memory cache)
   */
  public async getAdminUsers(): Promise<UserEntity[]> {
    if (this.adminUserIdsCache.size === 0) {
      await this.refreshMemoryCache();
    }

    let dbAdmins: UserEntity[] = [];
    try {
      if (typeof this.userRepo.find === 'function') {
        dbAdmins = await this.userRepo.find({
          where: { role: UserRole.ADMIN },
        });
      }
    } catch {
      // In tests or if table empty
    }

    const adminMap = new Map<string, UserEntity>();
    for (const a of dbAdmins) {
      adminMap.set(a.id, a);
    }

    for (const cachedId of this.adminUserIdsCache) {
      if (!adminMap.has(cachedId)) {
        try {
          if (typeof this.userRepo.findOne === 'function') {
            const u = await this.userRepo.findOne({ where: { id: cachedId } });
            if (u) adminMap.set(u.id, u);
          }
        } catch {
          // ignore
        }
      }
    }

    return Array.from(adminMap.values());
  }

  public isAdmin(userId: string | number): boolean {
    const strId = userId.toString();
    const ownId = this.zcaService?.getOwnId();
    if (ownId && ownId === strId) {
      return true;
    }
    return this.adminUserIdsCache.has(strId);
  }

  public isAllowed(userId: string | number): boolean {
    const strId = userId.toString();
    return this.isAdmin(strId) || this.allowedUserIdsCache.has(strId);
  }

  /**
   * Check if user is granted access (using Redis cache first, falling back to PostgreSQL)
   */
  public async isGrantAccess(userId: string | number): Promise<boolean> {
    const strId = userId.toString();

    // 1. Admin is always granted access
    if (this.isAdmin(strId)) {
      void this.redisService?.setWhitelist(strId, true);
      return true;
    }

    // 2. Check Redis whitelist cache first
    const cached = await this.redisService?.getWhitelist(strId);
    if (cached === '1') {
      this.allowedUserIdsCache.add(strId);
      return true;
    }
    if (cached === '0') {
      this.allowedUserIdsCache.delete(strId);
      return false;
    }

    // 3. Cache miss: Check PostgreSQL database
    const user = await this.userRepo.findOne({ where: { id: strId } });
    const isGranted = Boolean(
      user && (user.role === UserRole.ADMIN || user.grantAccess === GrantAccessStatus.GRANTED),
    );

    // 4. Update Redis & memory cache
    void this.redisService?.setWhitelist(strId, isGranted);
    if (isGranted) {
      this.allowedUserIdsCache.add(strId);
    } else {
      this.allowedUserIdsCache.delete(strId);
    }

    return isGranted;
  }

  /**
   * Register pending user with grantAccess = DENIED if they don't exist yet.
   * If the user is an admin, promote or keep them as ADMIN with GRANTED access.
   */
  public async registerPendingUser(
    userId: string | number,
    firstName?: string,
  ): Promise<UserEntity> {
    const strId = userId.toString();
    if (this.isAdmin(strId)) {
      let existing = await this.userRepo.findOne({ where: { id: strId } });
      if (!existing) {
        existing = this.userRepo.create({
          id: strId,
          role: UserRole.ADMIN,
          grantAccess: GrantAccessStatus.GRANTED,
          firstName: firstName || undefined,
          createdAt: new Date(),
        });
        await this.userRepo.save(existing);
      } else if (
        existing.role !== UserRole.ADMIN ||
        existing.grantAccess !== GrantAccessStatus.GRANTED
      ) {
        existing.role = UserRole.ADMIN;
        existing.grantAccess = GrantAccessStatus.GRANTED;
        if (firstName && existing.firstName !== firstName) {
          existing.firstName = firstName;
        }
        await this.userRepo.save(existing);
      }
      this.adminUserIdsCache.add(strId);
      this.allowedUserIdsCache.add(strId);
      void this.redisService?.setWhitelist(strId, true);
      return existing;
    }

    let existing = await this.userRepo.findOne({ where: { id: strId } });
    if (!existing) {
      existing = this.userRepo.create({
        id: strId,
        role: UserRole.USER,
        grantAccess: GrantAccessStatus.DENIED,
        firstName: firstName || undefined,
        createdAt: new Date(),
      });
      await this.userRepo.save(existing);
      void this.redisService?.setWhitelist(strId, false);
      this.allowedUserIdsCache.delete(strId);
    } else {
      if (firstName && existing.firstName !== firstName) {
        existing.firstName = firstName;
        await this.userRepo.save(existing);
      }
    }
    return existing;
  }

  /**
   * Grant or revoke whitelist access for a user.
   */
  public async setGrantAccess(
    userId: string | number,
    grantAccess: GrantAccessStatus,
  ): Promise<UserEntity> {
    const strId = userId.toString();
    let user = await this.userRepo.findOne({ where: { id: strId } });
    if (!user) {
      user = this.userRepo.create({
        id: strId,
        role: UserRole.USER,
        grantAccess,
        createdAt: new Date(),
      });
    } else {
      user.grantAccess = grantAccess;
    }
    await this.userRepo.save(user);

    const isAllowed = user.role === UserRole.ADMIN || grantAccess === GrantAccessStatus.GRANTED;
    if (isAllowed) {
      this.allowedUserIdsCache.add(strId);
    } else {
      this.allowedUserIdsCache.delete(strId);
    }
    void this.redisService?.setWhitelist(strId, isAllowed);
    return user;
  }

  public async getPreferredLocale(userId: string | number): Promise<SupportedLocale> {
    const user = await this.userRepo.findOne({ where: { id: userId.toString() } });
    return normalizeLocale(user?.preferredLocale);
  }

  public async setPreferredLocale(
    userId: string | number,
    locale: SupportedLocale,
  ): Promise<SupportedLocale> {
    const user = await this.upsertUser(userId);
    user.preferredLocale = normalizeLocale(locale);
    await this.userRepo.save(user);
    return user.preferredLocale;
  }

  public checkCooldown(userId: string | number): {
    allowed: boolean;
    reason?: string;
    waitSeconds?: number;
  } {
    const strId = userId.toString();
    const now = Date.now();
    const isUserAdmin = this.isAdmin(userId);

    const lastTime = this.lastRequestTimes.get(strId) || 0;
    const timeSinceLast = (now - lastTime) / 1000;

    if (timeSinceLast < this.cooldownSeconds && !isUserAdmin) {
      const waitSeconds = Math.ceil(this.cooldownSeconds - timeSinceLast);
      return {
        allowed: false,
        reason: `⏳ Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ ${waitSeconds} giây trước khi gửi tiếp nhé!`,
        waitSeconds,
      };
    }

    this.lastRequestTimes.set(strId, now);
    return { allowed: true };
  }

  public async allowUser(userId: string | number, role: UserRole = UserRole.USER): Promise<void> {
    await this.upsertUser(userId, role, { grantAccess: GrantAccessStatus.GRANTED });
  }

  public async upsertUser(
    userId: string | number,
    role: UserRole = UserRole.USER,
    extra?: {
      username?: string;
      firstName?: string;
      avatarUrl?: string;
      phoneNumber?: string;
      grantAccess?: GrantAccessStatus;
    },
  ): Promise<UserEntity> {
    const strId = userId.toString();
    const isAdmin = role === UserRole.ADMIN || this.isBotAccount(strId);
    const finalRole: UserRole = isAdmin ? UserRole.ADMIN : role;
    const finalGrantAccess: GrantAccessStatus = isAdmin
      ? GrantAccessStatus.GRANTED
      : extra?.grantAccess !== undefined
        ? extra.grantAccess
        : GrantAccessStatus.GRANTED;

    let existing = await this.userRepo.findOne({ where: { id: strId } });
    if (!existing) {
      existing = this.userRepo.create({
        id: strId,
        role: finalRole,
        grantAccess: finalGrantAccess,
        username: extra?.username,
        firstName: extra?.firstName,
        avatarUrl: extra?.avatarUrl,
        phoneNumber: extra?.phoneNumber,
        createdAt: new Date(),
      });
    } else {
      existing.role = finalRole;
      if (extra?.grantAccess !== undefined || isAdmin) {
        existing.grantAccess = finalGrantAccess;
      }
      if (extra?.username) existing.username = extra.username;
      if (extra?.firstName) existing.firstName = extra.firstName;
      if (extra?.avatarUrl) existing.avatarUrl = extra.avatarUrl;
      if (extra?.phoneNumber) existing.phoneNumber = extra.phoneNumber;
    }
    await this.userRepo.save(existing);
    if (extra?.phoneNumber) await this.fillLinkedContactPhones(strId, extra.phoneNumber);

    if (finalRole === UserRole.ADMIN) this.adminUserIdsCache.add(strId);
    else this.adminUserIdsCache.delete(strId);

    const isAllowed =
      finalRole === UserRole.ADMIN || existing.grantAccess === GrantAccessStatus.GRANTED;
    if (isAllowed) this.allowedUserIdsCache.add(strId);
    else this.allowedUserIdsCache.delete(strId);

    void this.redisService?.setWhitelist(strId, isAllowed);
    return existing;
  }

  public async banUser(userId: string | number): Promise<boolean> {
    if (this.isAdmin(userId)) {
      this.logger.warn(`Attempted to ban admin user ${userId}. Operation aborted.`);
      return false;
    }
    const strId = userId.toString();
    const existing = await this.userRepo.findOne({ where: { id: strId } });
    if (existing) {
      await this.userRepo.remove(existing);
      this.allowedUserIdsCache.delete(strId);
      this.adminUserIdsCache.delete(strId);
      void this.redisService?.delWhitelist(strId);
      return true;
    }
    return false;
  }

  /**
   * Who a dashboard session belongs to, for the account card in the navigation. The name comes from
   * the ZCA directory (cached, never fetched from Zalo here), like the `/zca` user list, then from
   * `firstName`.
   */
  public async getSessionProfile(userId: string | number): Promise<IDashboardSessionUser> {
    const id = userId.toString();
    const user = await this.userRepo.findOne({ where: { id } });
    const isDashboardOwner = id === DASHBOARD_OWNER_USER_ID;
    if (isDashboardOwner) {
      // The default owner name is shown translated by the web; a renamed owner keeps its name.
      const customName = user?.firstName !== DASHBOARD_OWNER_NAME ? user?.firstName : undefined;
      return {
        id,
        name: customName || null,
        avatarUrl: user?.avatarUrl || null,
        isAdmin: this.isAdmin(id),
        isDashboardOwner,
      };
    }

    const threads = this.zcaService
      ? await this.zcaService.getAvailableThreads(false).catch((): AvailableThread[] => [])
      : [];
    const entry = threads.find((t) => t.id === id && t.type === 'user');
    const zcaName = entry ? entry.alias || entry.name || entry.displayName : undefined;
    return {
      id,
      name: zcaName || user?.firstName || null,
      avatarUrl: user?.avatarUrl || entry?.avatar || null,
      isAdmin: this.isAdmin(id),
      isDashboardOwner,
    };
  }

  /**
   * Zalo names of the given user ids from the ZCA directory (cached, never fetched from Zalo
   * here), for screens that list many people at once. Ids not in the directory are left out.
   */
  public async resolveZaloNames(ids: readonly string[]): Promise<Map<string, string>> {
    const wanted = new Set(ids);
    if (!wanted.size || !this.zcaService) return new Map();
    const threads = await this.zcaService
      .getAvailableThreads(false)
      .catch((): AvailableThread[] => []);
    return new Map(
      threads.flatMap((t): [string, string][] => {
        if (t.type !== 'user' || !wanted.has(t.id)) return [];
        const name = (t.alias || t.name || t.displayName)?.trim();
        return name ? [[t.id, name]] : [];
      }),
    );
  }

  public async getUsers(): Promise<
    Array<UserEntity & { alias?: string; zaloName?: string; displayName?: string }>
  > {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    if (!this.zcaService) {
      return users;
    }

    try {
      const threads = await this.zcaService
        .getAvailableThreads(false)
        .catch((): AvailableThread[] => []);
      if (!threads || threads.length === 0) return users;

      const threadMap = new Map<string, AvailableThread>();
      for (const t of threads) {
        threadMap.set(t.id, t);
      }

      return users.map((u) => {
        const t = threadMap.get(u.id);
        if (!t) return u;
        return {
          ...u,
          firstName: t.alias || t.name || u.firstName,
          avatarUrl: u.avatarUrl || t.avatar,
          phoneNumber: u.phoneNumber || t.phoneNumber,
          alias: t.alias,
          displayName: t.displayName,
          zaloName: t.displayName || t.zaloName,
        };
      });
    } catch {
      return users;
    }
  }

  public async syncUsersWithZca(): Promise<{ syncedCount: number; totalUsers: number }> {
    if (!this.zcaService) {
      return { syncedCount: 0, totalUsers: 0 };
    }
    const threads = await this.zcaService
      .getAvailableThreads(true)
      .catch((): AvailableThread[] => []);
    if (!threads || threads.length === 0) {
      return { syncedCount: 0, totalUsers: 0 };
    }

    const threadMap = new Map<string, AvailableThread>();
    for (const t of threads) {
      // Group threads never map to a user record.
      if (t.type === 'user') threadMap.set(t.id, t);
    }

    const users = await this.userRepo.find();
    let syncedCount = 0;

    for (const user of users) {
      const t = threadMap.get(user.id);
      if (t) {
        let changed = false;
        if (t.avatar && user.avatarUrl !== t.avatar) {
          user.avatarUrl = t.avatar;
          changed = true;
        }
        if (t.phoneNumber && user.phoneNumber !== t.phoneNumber) {
          user.phoneNumber = t.phoneNumber;
          changed = true;
        }
        if (user.phoneNumber) await this.fillLinkedContactPhones(user.id, user.phoneNumber);
        const isGenericName =
          !user.firstName ||
          user.firstName === 'bạn' ||
          user.firstName === 'Người dùng Zalo' ||
          user.firstName.trim() === '';
        const zcaName = t.alias || t.name || t.displayName || t.zaloName;
        if (
          (isGenericName ||
            !user.firstName ||
            (t.displayName && user.firstName === t.displayName)) &&
          zcaName &&
          user.firstName !== zcaName
        ) {
          user.firstName = zcaName;
          changed = true;
        }

        if (changed) {
          await this.userRepo.save(user);
          syncedCount++;
        }
      }
    }

    return { syncedCount, totalUsers: users.length };
  }

  public async updateUserProfile(
    id: string,
    data: { firstName?: string; phoneNumber?: string; avatarUrl?: string },
  ): Promise<UserEntity | null> {
    const user = await this.getUser(id);
    if (!user) return null;
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.phoneNumber !== undefined) user.phoneNumber = data.phoneNumber;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    await this.userRepo.save(user);
    if (data.phoneNumber) await this.fillLinkedContactPhones(id, data.phoneNumber);
    return user;
  }

  /**
   * Lưu dự phòng SĐT (Zalo hay ẩn số): điền số của user vào các Người liên quan đã gắn
   * với user này mà còn trống số. Không ghi đè số đã có trong danh bạ.
   */
  public async fillLinkedContactPhones(userId: string, phoneNumber: string): Promise<number> {
    const phone = phoneNumber.trim();
    if (!phone || !this.contactRepo) return 0;
    const [nullResult, emptyResult] = await Promise.all([
      this.contactRepo.update(
        { linkedUserId: userId, phoneNumber: IsNull() },
        { phoneNumber: phone },
      ),
      this.contactRepo.update({ linkedUserId: userId, phoneNumber: '' }, { phoneNumber: phone }),
    ]);
    return (nullResult.affected ?? 0) + (emptyResult.affected ?? 0);
  }

  /** True when the ID is the bot's own ZCA account (always recreated as admin on startup). */
  public isBotAccount(userId: string | number): boolean {
    const ownId = this.zcaService?.getOwnId();
    return Boolean(ownId) && ownId === userId.toString().trim();
  }

  /** Drop caches/whitelist of a merged-away user and rebuild caches for the surviving user. */
  public async afterUsersMerged(sourceUserId: string, targetUserId: string): Promise<void> {
    this.adminUserIdsCache.delete(sourceUserId);
    this.allowedUserIdsCache.delete(sourceUserId);
    this.lastRequestTimes.delete(sourceUserId);
    await this.redisService?.delWhitelist(sourceUserId);
    await this.refreshMemoryCache();
    this.logger.log(`Caches refreshed after merging ${sourceUserId} into ${targetUserId}.`);
  }

  public getUser(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  public async updateRole(id: string, role: UserRole): Promise<UserEntity | null> {
    const user = await this.getUser(id);
    if (!user) return null;
    return this.upsertUser(id, role, {
      grantAccess: role === UserRole.ADMIN ? GrantAccessStatus.GRANTED : user.grantAccess,
    });
  }

  public async saveDriveFolderInfo(
    userId: string | number,
    folderInfo: { folderId?: string; folderUrl?: string; folderPath?: string },
  ): Promise<void> {
    try {
      const strId = userId.toString();
      // Users are only created by explicit flows (pending registration, admin bootstrap, dashboard).
      // Creating one here turned group ids into fake "pending" users.
      const user = await this.userRepo.findOne({ where: { id: strId } });
      if (!user) {
        this.logger.warn(`Skip saving Drive folder info: user ${strId} does not exist.`);
        return;
      }
      if (folderInfo.folderId !== undefined) user.driveFolderId = folderInfo.folderId;
      if (folderInfo.folderUrl !== undefined) user.driveFolderUrl = folderInfo.folderUrl;
      if (folderInfo.folderPath !== undefined) user.driveFolderPath = folderInfo.folderPath;
      await this.userRepo.save(user);
    } catch (err) {
      this.logger.warn(
        `Could not save Drive folder info for user ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
