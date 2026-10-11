import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { normalizeLocale, type SupportedLocale } from '@zalobot/contracts';

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
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.seedInitialUsers();
    await this.refreshMemoryCache();
  }

  private async refreshMemoryCache(): Promise<void> {
    try {
      const users = await this.userRepo.find();
      this.allowedUserIdsCache.clear();
      this.adminUserIdsCache.clear();

      for (const u of users) {
        this.allowedUserIdsCache.add(u.id);
        if (u.role === 'admin') {
          this.adminUserIdsCache.add(u.id);
        }
      }

      // Also include env admin & allowed IDs from Zalo configuration
      const adminId = this.configService.get<string>('zalo.adminId');
      if (adminId) {
        this.adminUserIdsCache.add(adminId.toString());
        this.allowedUserIdsCache.add(adminId.toString());
      }

      const allowedIds = this.configService.get<string[]>('zalo.allowedUserIds') || [];
      for (const id of allowedIds) {
        this.allowedUserIdsCache.add(id.toString());
      }

      this.logger.log(
        `PostgreSQL initialized with ${users.length} registered users (Admins: ${this.adminUserIdsCache.size}).`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error refreshing memory cache: ${error.message}`);
    }
  }

  private async seedInitialUsers(): Promise<void> {
    const adminIdEnv = this.configService.get<string>('zalo.adminId');
    const allowedIds = this.configService.get<string[]>('zalo.allowedUserIds') || [];

    if (adminIdEnv) {
      const adminStr = adminIdEnv.toString();
      const existing = await this.userRepo.findOne({ where: { id: adminStr } });
      if (!existing) {
        const adminUser = this.userRepo.create({
          id: adminStr,
          role: 'admin',
          createdAt: new Date(),
        });
        await this.userRepo.save(adminUser);
      }
    }

    if (allowedIds && allowedIds.length > 0) {
      for (const [index, idStr] of allowedIds.entries()) {
        const strId = idStr.toString();
        const existing = await this.userRepo.findOne({ where: { id: strId } });
        if (!existing) {
          const isFirstOrAdmin = adminIdEnv ? strId === adminIdEnv : index === 0;
          const user = this.userRepo.create({
            id: strId,
            role: isFirstOrAdmin ? 'admin' : 'user',
            createdAt: new Date(),
          });
          await this.userRepo.save(user);
        }
      }
    }
  }

  public hasAdminConfigured(): boolean {
    return this.adminUserIdsCache.size > 0;
  }

  public isAdmin(userId: string | number): boolean {
    return this.adminUserIdsCache.has(userId.toString());
  }

  public isAllowed(userId: string | number): boolean {
    const strId = userId.toString();
    return this.allowedUserIdsCache.has(strId);
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

  public async allowUser(userId: string | number, role: 'admin' | 'user' = 'user'): Promise<void> {
    await this.upsertUser(userId, role);
  }

  public async upsertUser(
    userId: string | number,
    role: 'admin' | 'user' = 'user',
    extra?: { username?: string; firstName?: string; avatarUrl?: string },
  ): Promise<UserEntity> {
    const strId = userId.toString();
    let existing = await this.userRepo.findOne({ where: { id: strId } });
    if (!existing) {
      existing = this.userRepo.create({
        id: strId,
        role,
        username: extra?.username,
        firstName: extra?.firstName,
        avatarUrl: extra?.avatarUrl,
        createdAt: new Date(),
      });
    } else {
      if (role) existing.role = role;
      if (extra?.username) existing.username = extra.username;
      if (extra?.firstName) existing.firstName = extra.firstName;
      if (extra?.avatarUrl) existing.avatarUrl = extra.avatarUrl;
    }
    await this.userRepo.save(existing);
    this.allowedUserIdsCache.add(strId);
    if (role === 'admin') this.adminUserIdsCache.add(strId);
    else this.adminUserIdsCache.delete(strId);
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
      return true;
    }
    return false;
  }

  public async getUsers(): Promise<UserEntity[]> {
    return this.userRepo.find();
  }

  public getUser(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  public async updateRole(id: string, role: 'admin' | 'user'): Promise<UserEntity | null> {
    const user = await this.getUser(id);
    if (!user) return null;
    return this.upsertUser(id, role);
  }
}
