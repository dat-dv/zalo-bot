import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import {
  UserRole,
  GrantAccessStatus,
  normalizeLocale,
  type SupportedLocale,
} from '@zalobot/contracts';
import { RedisService } from '../redis/redis.service';

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
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.refreshMemoryCache();
  }

  private getEnvAdminIds(): Set<string> {
    const raw = process.env.ADMIN_USER_IDS || '';
    return new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  public async refreshMemoryCache(): Promise<void> {
    try {
      const envAdminIds = this.getEnvAdminIds();

      // Ensure all env admins exist in DB and have role=ADMIN & grantAccess=GRANTED
      for (const adminId of envAdminIds) {
        let u = await this.userRepo.findOne({ where: { id: adminId } });
        if (!u) {
          u = this.userRepo.create({
            id: adminId,
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
        const isAdmin = u.role === UserRole.ADMIN || envAdminIds.has(u.id);
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
    const strId = userId.toString();
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

    this.logger.log(`🎉 User ${strId} (${firstName || 'User'}) bootstrapped as FIRST admin!`);
    return user;
  }

  public hasAdminConfigured(): boolean {
    return this.adminUserIdsCache.size > 0;
  }

  /**
   * Get all admin users in the system (from DB role=ADMIN, env ADMIN_USER_IDS, and memory cache)
   */
  public async getAdminUsers(): Promise<UserEntity[]> {
    if (this.adminUserIdsCache.size === 0) {
      await this.refreshMemoryCache();
    }

    const envAdminIds = Array.from(this.getEnvAdminIds());
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

    for (const envId of envAdminIds) {
      if (!adminMap.has(envId)) {
        adminMap.set(envId, {
          id: envId,
          role: UserRole.ADMIN,
          grantAccess: GrantAccessStatus.GRANTED,
          preferredLocale: 'vi',
          timezone: 'Asia/Ho_Chi_Minh',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return Array.from(adminMap.values());
  }

  public isAdmin(userId: string | number): boolean {
    const strId = userId.toString();
    return this.adminUserIdsCache.has(strId) || this.getEnvAdminIds().has(strId);
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
   * Register pending user with grantAccess = DENIED if they don't exist yet
   */
  public async registerPendingUser(
    userId: string | number,
    firstName?: string,
  ): Promise<UserEntity> {
    const strId = userId.toString();
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
      grantAccess?: GrantAccessStatus;
    },
  ): Promise<UserEntity> {
    const strId = userId.toString();
    const isAdmin = role === UserRole.ADMIN || this.getEnvAdminIds().has(strId);
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
    }
    await this.userRepo.save(existing);

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

  public async getUsers(): Promise<UserEntity[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
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
      let user = await this.userRepo.findOne({ where: { id: strId } });
      if (!user) {
        user = this.userRepo.create({
          id: strId,
          role: UserRole.USER,
          grantAccess: GrantAccessStatus.DENIED,
        });
      }
      if (folderInfo.folderId !== undefined) user.driveFolderId = folderInfo.folderId;
      if (folderInfo.folderUrl !== undefined) user.driveFolderUrl = folderInfo.folderUrl;
      if (folderInfo.folderPath !== undefined) user.driveFolderPath = folderInfo.folderPath;
      await this.userRepo.save(user);
    } catch (err) {
      this.logger.warn(`Could not save Drive folder info for user ${userId}: ${(err as Error).message}`);
    }
  }
}
