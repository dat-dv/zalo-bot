import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { ThreadBotConfig, UpdateThreadBotConfigDto } from '@zalobot/contracts';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { RedisService } from '../redis/redis.service';

export const REDIS_KEY_LISTENED_THREADS = 'zca:listened_threads';
export const REDIS_KEY_THREAD_CONFIG_PREFIX = 'zca:thread_config:';
export const REDIS_CONFIG_CACHE_TTL_SECONDS = 86400; // 24 hours

export function sanitizePathSegment(val: string): string {
  return (val || '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export function createDefaultThreadConfig(
  threadId: string,
  params?: {
    threadName?: string;
    threadType?: 'user' | 'group';
    isListened?: boolean;
  },
): ThreadBotConfig {
  const isGroup = params?.threadType === 'group' || threadId.startsWith('g-');
  const safeName = params?.threadName ? sanitizePathSegment(params.threadName) : threadId;

  return {
    threadId,
    threadName: params?.threadName,
    threadType: params?.threadType || (isGroup ? 'group' : 'user'),
    isListened: params?.isListened ?? false,
    directInteraction: {
      enabled: false,
      requireMention: true,
      triggerPrefix: '',
      allowAiChat: false,
      allowSelf: false,
    },
    mediaBackup: {
      enabled: false,
      uploadImages: false,
      uploadVideos: false,
      customFolder: params?.threadName ? `zalobot/${safeName}` : '',
      fileSuffix: safeName ? `_${safeName}` : '',
    },
    expenseTracking: {
      enabled: false,
      requireConfirm: false,
    },
    calendarExtraction: {
      enabled: false,
      requireConfirm: false,
    },
    confirmationRules: {
      allowReactions: false,
      requiredHearts: isGroup ? 5 : 1,
      timeoutMinutes: 5,
    },
    updatedAt: Date.now(),
  };
}

export function entityToConfig(entity: ZcaThreadConfigEntity): ThreadBotConfig {
  return {
    threadId: entity.threadId,
    threadName: entity.threadName || undefined,
    threadType: entity.threadType || 'user',
    isListened: Boolean(entity.isListened),
    directInteraction: {
      enabled: entity.directInteraction?.enabled ?? false,
      requireMention:
        entity.directInteraction?.requireMention !== undefined
          ? entity.directInteraction.requireMention
          : true,
      triggerPrefix: entity.directInteraction?.triggerPrefix || '',
      allowAiChat: entity.directInteraction?.allowAiChat ?? false,
      allowSelf: entity.directInteraction?.allowSelf ?? false,
    },
    mediaBackup: {
      enabled: entity.mediaBackup?.enabled ?? false,
      uploadImages: entity.mediaBackup?.uploadImages ?? false,
      uploadVideos: entity.mediaBackup?.uploadVideos ?? false,
      customFolder: entity.mediaBackup?.customFolder || '',
      fileSuffix: entity.mediaBackup?.fileSuffix || '',
    },
    expenseTracking: {
      enabled: entity.expenseTracking?.enabled ?? false,
      requireConfirm: entity.expenseTracking?.requireConfirm ?? false,
    },
    calendarExtraction: {
      enabled: entity.calendarExtraction?.enabled ?? false,
      requireConfirm: entity.calendarExtraction?.requireConfirm ?? false,
    },
    confirmationRules: {
      allowReactions: entity.confirmationRules?.allowReactions ?? false,
      requiredHearts:
        entity.confirmationRules?.requiredHearts ?? (entity.threadType === 'group' ? 5 : 1),
      timeoutMinutes: entity.confirmationRules?.timeoutMinutes ?? 5,
    },
    updatedAt: entity.updatedAt ? new Date(entity.updatedAt).getTime() : Date.now(),
  };
}

@Injectable()
export class ThreadConfigService implements OnModuleInit {
  private readonly logger = new Logger(ThreadConfigService.name);
  private readonly configsFilePath: string;
  private readonly whitelistFilePath: string;
  private configsMap = new Map<string, ThreadBotConfig>();

  constructor(
    @Optional()
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadConfigRepo?: Repository<ZcaThreadConfigEntity>,
    @Optional()
    private readonly redisService?: RedisService,
    @Optional()
    private readonly configService?: ConfigService,
  ) {
    const dataDir =
      this.configService?.get<string>('zca.dataDir') ||
      this.configService?.get<string>('DATA_DIR') ||
      process.env.DATA_DIR ||
      process.env.ZCA_DATA_DIR;

    const baseDir = dataDir
      ? path.resolve(process.cwd(), dataDir)
      : fs.existsSync(path.resolve(process.cwd(), 'data'))
        ? path.resolve(process.cwd(), 'data')
        : process.cwd();

    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    } catch {
      // ignore
    }

    this.configsFilePath = path.resolve(baseDir, '.zca-thread-configs.json');
    this.whitelistFilePath = path.resolve(baseDir, '.zca-listened-threads.json');
  }

  public async onModuleInit(): Promise<void> {
    await this.loadConfigs();
  }

  public async loadConfigs(): Promise<void> {
    try {
      let loadedFromDb = false;

      // 1. Load from PostgreSQL database if repository is available
      if (this.threadConfigRepo) {
        try {
          const entities = await this.threadConfigRepo.find();
          if (entities && entities.length > 0) {
            for (const entity of entities) {
              if (entity.threadId === 'thread-123') continue;
              this.configsMap.set(entity.threadId, entityToConfig(entity));
            }
            loadedFromDb = true;
            this.logger.log(
              `[ThreadConfigService] Loaded ${this.configsMap.size} thread configs from PostgreSQL.`,
            );
          }
        } catch (dbErr) {
          this.logger.warn(
            `[ThreadConfigService] Could not read configs from DB: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
          );
        }
      }

      // 2. If DB was empty or not available, load from legacy JSON and migrate
      const candidateConfigsPath = fs.existsSync(this.configsFilePath)
        ? this.configsFilePath
        : path.resolve(process.cwd(), '.zca-thread-configs.json');

      if (!loadedFromDb && fs.existsSync(candidateConfigsPath)) {
        try {
          const raw = await fs.promises.readFile(candidateConfigsPath, 'utf8');
          const parsed = JSON.parse(raw) as Record<string, ThreadBotConfig>;
          if (parsed && typeof parsed === 'object') {
            for (const [id, config] of Object.entries(parsed)) {
              if (id === 'thread-123' || config.threadId === 'thread-123') continue;
              this.configsMap.set(id, config);
              if (this.threadConfigRepo) {
                await this.saveConfigToDb(config);
              }
            }
          }
        } catch (fileErr) {
          this.logger.warn(
            `[ThreadConfigService] Could not read legacy configs file: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`,
          );
        }
      }

      // 3. Sync to Redis for fast lookups
      if (this.redisService?.isReady) {
        await this.syncListenedThreadsToRedis();
        for (const [, cfg] of this.configsMap.entries()) {
          await this.cacheConfigToRedis(cfg);
        }
        this.logger.log(`[ThreadConfigService] Synced configs and whitelist to Redis.`);
      }

      // 4. Save sanitized fallback files (never storing thread-123)
      await this.saveLegacyFiles();

      this.logger.log(
        `[ThreadConfigService] Initialized with ${this.configsMap.size} thread configs.`,
      );
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Could not load thread configs: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  public async saveConfigs(): Promise<void> {
    for (const config of this.configsMap.values()) {
      await this.saveConfigToDb(config);
      await this.cacheConfigToRedis(config);
    }
    await this.syncListenedThreadsToRedis();
    await this.saveLegacyFiles();
  }

  public async getConfig(
    threadId: string,
    meta?: { threadName?: string; threadType?: 'user' | 'group' },
  ): Promise<ThreadBotConfig> {
    const id = String(threadId).trim();

    // 1. In-memory check
    let config = this.configsMap.get(id);

    // 2. Redis cache check
    if (!config && this.redisService?.isReady) {
      try {
        const cachedRaw = await this.redisService.get(`${REDIS_KEY_THREAD_CONFIG_PREFIX}${id}`);
        if (cachedRaw) {
          config = JSON.parse(cachedRaw) as ThreadBotConfig;
          this.configsMap.set(id, config);
        }
      } catch {
        // Continue to DB check
      }
    }

    // 3. PostgreSQL DB check
    if (!config && this.threadConfigRepo) {
      try {
        const entity = await this.threadConfigRepo.findOneBy({ threadId: id });
        if (entity) {
          config = entityToConfig(entity);
          this.configsMap.set(id, config);
          await this.cacheConfigToRedis(config);
        }
      } catch (err) {
        this.logger.warn(
          `[ThreadConfigService] DB findOneBy failed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 4. Create default config if not found
    if (!config) {
      config = createDefaultThreadConfig(id, {
        threadName: meta?.threadName,
        threadType: meta?.threadType,
        isListened: false,
      });
      this.configsMap.set(id, config);
      await this.saveConfigToDb(config);
      await this.cacheConfigToRedis(config);
      await this.saveLegacyFiles();
    } else if (meta?.threadName && (!config.threadName || config.threadName !== meta.threadName)) {
      config.threadName = meta.threadName;
      if (meta.threadType) config.threadType = meta.threadType;
      await this.saveConfigToDb(config);
      await this.cacheConfigToRedis(config);
    }

    return config;
  }

  public getAllConfigs(): ThreadBotConfig[] {
    return Array.from(this.configsMap.values()).filter((c) => c.threadId !== 'thread-123');
  }

  public getConfigSync(threadId: string): ThreadBotConfig | undefined {
    const id = String(threadId).trim();
    return this.configsMap.get(id);
  }

  public getListenedThreadIds(): string[] {
    const ids: string[] = [];
    for (const [id, cfg] of this.configsMap.entries()) {
      if (cfg.isListened && id !== 'thread-123') {
        ids.push(id);
      }
    }
    return ids;
  }

  public async isThreadListened(threadId: string): Promise<boolean> {
    const id = String(threadId).trim();
    if (!id || id === 'thread-123') return false;

    // Fast check via Redis
    if (this.redisService?.isReady) {
      const isMember = await this.redisService.sismember(REDIS_KEY_LISTENED_THREADS, id);
      if (isMember) return true;
    }

    // Check in-memory map
    const cfg = this.configsMap.get(id);
    return Boolean(cfg?.isListened);
  }

  public async updateConfig(
    threadId: string,
    update: UpdateThreadBotConfigDto,
    meta?: { threadName?: string; threadType?: 'user' | 'group' },
  ): Promise<ThreadBotConfig> {
    const id = String(threadId).trim();
    const config = await this.getConfig(id, meta);

    if (update.threadName !== undefined) {
      config.threadName = update.threadName;
    }

    if (update.threadType !== undefined) {
      config.threadType = update.threadType;
    }

    if (update.isListened !== undefined) {
      config.isListened = Boolean(update.isListened);
    }

    if (update.directInteraction) {
      config.directInteraction = {
        ...config.directInteraction,
        ...update.directInteraction,
      };
    }

    if (update.mediaBackup) {
      config.mediaBackup = {
        ...config.mediaBackup,
        ...update.mediaBackup,
      };
    }

    if (update.expenseTracking) {
      config.expenseTracking = {
        ...config.expenseTracking,
        ...update.expenseTracking,
      };
    }

    if (update.calendarExtraction) {
      config.calendarExtraction = {
        ...config.calendarExtraction,
        ...update.calendarExtraction,
      };
    }

    if (update.confirmationRules) {
      config.confirmationRules = {
        ...config.confirmationRules,
        ...update.confirmationRules,
      };
    }

    config.updatedAt = Date.now();
    this.configsMap.set(id, config);

    // Save to Database
    await this.saveConfigToDb(config);

    // Update Redis cache & Whitelist set
    await this.cacheConfigToRedis(config);
    if (this.redisService?.isReady) {
      if (config.isListened) {
        await this.redisService.sadd(REDIS_KEY_LISTENED_THREADS, id);
      } else {
        await this.redisService.srem(REDIS_KEY_LISTENED_THREADS, id);
      }
    }

    await this.saveLegacyFiles();
    return config;
  }

  public async setListened(threadId: string, isListened: boolean): Promise<ThreadBotConfig> {
    const config = await this.getConfig(threadId);
    const directInteraction =
      isListened && !config.directInteraction?.enabled
        ? {
            enabled: true,
            requireMention:
              config.directInteraction?.requireMention !== undefined
                ? config.directInteraction.requireMention
                : true,
            triggerPrefix: config.directInteraction?.triggerPrefix || '',
            allowAiChat: true,
            allowSelf: config.directInteraction?.allowSelf ?? false,
          }
        : undefined;

    return this.updateConfig(threadId, {
      isListened,
      ...(directInteraction ? { directInteraction } : {}),
    });
  }

  public async toggleListened(threadId: string): Promise<boolean> {
    const config = await this.getConfig(threadId);
    const newStatus = !config.isListened;
    await this.setListened(threadId, newStatus);
    return newStatus;
  }

  private async saveConfigToDb(config: ThreadBotConfig): Promise<void> {
    if (!this.threadConfigRepo || config.threadId === 'thread-123') return;
    try {
      await this.threadConfigRepo.upsert(
        {
          threadId: config.threadId,
          threadName: config.threadName,
          threadType: config.threadType || 'user',
          isListened: Boolean(config.isListened),
          directInteraction: config.directInteraction,
          mediaBackup: config.mediaBackup,
          expenseTracking: config.expenseTracking,
          calendarExtraction: config.calendarExtraction,
          confirmationRules: config.confirmationRules,
          updatedAt: new Date(config.updatedAt || Date.now()),
        },
        ['threadId'],
      );
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Failed to upsert thread config ${config.threadId} to DB: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async cacheConfigToRedis(config: ThreadBotConfig): Promise<void> {
    if (!this.redisService?.isReady || config.threadId === 'thread-123') return;
    try {
      await this.redisService.set(
        `${REDIS_KEY_THREAD_CONFIG_PREFIX}${config.threadId}`,
        JSON.stringify(config),
        REDIS_CONFIG_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Failed to cache config to Redis: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async syncListenedThreadsToRedis(): Promise<void> {
    if (!this.redisService?.isReady) return;
    try {
      const listenedIds = this.getListenedThreadIds();
      const current = await this.redisService.smembers(REDIS_KEY_LISTENED_THREADS);
      if (current.length > 0) {
        await this.redisService.srem(REDIS_KEY_LISTENED_THREADS, ...current);
      }
      if (listenedIds.length > 0) {
        await this.redisService.sadd(REDIS_KEY_LISTENED_THREADS, ...listenedIds);
      }
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Failed to sync listened threads to Redis: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async saveLegacyFiles(): Promise<void> {
    try {
      const data: Record<string, ThreadBotConfig> = {};
      const listenedIds: string[] = [];

      for (const [id, cfg] of this.configsMap.entries()) {
        if (id === 'thread-123') continue;
        data[id] = cfg;
        if (cfg.isListened) {
          listenedIds.push(id);
        }
      }

      const dir = path.dirname(this.configsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(this.configsFilePath, JSON.stringify(data, null, 2), 'utf8');
      await fs.promises.writeFile(
        this.whitelistFilePath,
        JSON.stringify(listenedIds, null, 2),
        'utf8',
      );
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Could not save fallback files: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  public async saveDriveFolderInfo(
    threadId: string,
    folderInfo: { folderId?: string; folderUrl?: string; folderPath?: string },
  ): Promise<void> {
    try {
      if (this.threadConfigRepo) {
        let entity = await this.threadConfigRepo.findOne({ where: { threadId } });
        if (!entity) {
          entity = this.threadConfigRepo.create({
            threadId,
            threadType: threadId.startsWith('g-') ? 'group' : 'user',
            isListened: false,
          });
        }
        if (folderInfo.folderId !== undefined) entity.driveFolderId = folderInfo.folderId;
        if (folderInfo.folderUrl !== undefined) entity.driveFolderUrl = folderInfo.folderUrl;
        if (folderInfo.folderPath !== undefined) entity.driveFolderPath = folderInfo.folderPath;
        await this.threadConfigRepo.save(entity);
      }
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Could not save Drive folder info for thread ${threadId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
