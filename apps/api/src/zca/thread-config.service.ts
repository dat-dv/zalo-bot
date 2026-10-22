import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import {
  CHAT_MEMORY_DEFAULTS,
  normalizeChatMemoryConfig,
  normalizeTriggerPrefixes,
  type ThreadBotConfig,
  type ThreadDirectInteractionConfig,
  type UpdateThreadBotConfigDto,
} from '@zalobot/contracts';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import {
  buildChannelStorageTarget,
  isSameDrivePath,
  resolveChannelDriveRoot,
  resolveChannelPhotosAlbumTitle,
  type ChannelStorageTarget,
} from '../google/channel-storage.util';
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

/**
 * Legacy Bot API group ids carry a `g-`/`group_` prefix. ZCA group ids are plain numbers, so this
 * is only a last-resort fallback after the stored thread config (see `isGroupThread`).
 */
export function hasLegacyGroupPrefix(threadId: string): boolean {
  return threadId.startsWith('g-') || threadId.startsWith('group_');
}

export type ThreadKind = 'user' | 'group';

export interface ThreadConfigMeta {
  threadName?: string;
  threadType?: ThreadKind;
}

/** Shape a stored `directInteraction` may still have from before `triggerPrefixes` existed. */
type StoredDirectInteraction = Partial<ThreadDirectInteractionConfig> & {
  triggerPrefix?: unknown;
  requireMention?: unknown;
};

/** Keeps only current fields; folds the legacy single `triggerPrefix` into `triggerPrefixes`. */
export function normalizeDirectInteraction(
  raw: StoredDirectInteraction | undefined,
): ThreadDirectInteractionConfig {
  return {
    enabled: raw?.enabled ?? false,
    triggerPrefixes: normalizeTriggerPrefixes({
      triggerPrefixes: raw?.triggerPrefixes,
      triggerPrefix: raw?.triggerPrefix,
    }),
    allowAiChat: raw?.allowAiChat ?? false,
    allowSelf: raw?.allowSelf ?? false,
  };
}

export function getThreadDriveRoot(config: ThreadBotConfig): string {
  return resolveChannelDriveRoot(config.threadId, config.mediaBackup?.customFolder);
}

/** Where the thread's media is stored: Drive root (+ category split), Photos album, file suffix. */
export function getThreadStorageTarget(config: ThreadBotConfig): ChannelStorageTarget {
  return buildChannelStorageTarget(config.threadId, {
    customFolder: config.mediaBackup?.customFolder,
    photosAlbum: config.mediaBackup?.photosAlbum,
    photosAlbumTitle: config.photosAlbumTitle,
    threadName: config.threadName,
    fileSuffix: config.mediaBackup?.fileSuffix,
  });
}

export function getThreadPhotosAlbumTitle(config: ThreadBotConfig): string {
  return resolveChannelPhotosAlbumTitle(config.threadId, {
    photosAlbum: config.mediaBackup?.photosAlbum,
    photosAlbumTitle: config.photosAlbumTitle,
    threadName: config.threadName,
  });
}

/**
 * Drops stored Drive/Photos links that no longer match the channel's storage root or album
 * (older versions stored the month sub-folder of the last upload; `customFolder` or
 * `photosAlbum` may have changed since). The "open" endpoints then resolve and store them again.
 */
export function withoutStaleStorageLinks(config: ThreadBotConfig): ThreadBotConfig {
  const next = { ...config };
  if (
    (next.driveFolderUrl || next.driveFolderId || next.driveFolderPath) &&
    !isSameDrivePath(next.driveFolderPath, getThreadDriveRoot(next))
  ) {
    next.driveFolderId = undefined;
    next.driveFolderUrl = undefined;
    next.driveFolderPath = undefined;
  }
  const albumOverride = next.mediaBackup?.photosAlbum?.trim();
  if (albumOverride && next.photosAlbumTitle?.trim() !== albumOverride) {
    next.photosAlbumId = undefined;
    next.photosAlbumUrl = undefined;
    next.photosAlbumTitle = undefined;
  }
  return next;
}

/** Redis and the legacy JSON file may hold configs written by older versions. */
function normalizeCachedConfig(
  raw: ThreadBotConfig & { expenseTracking?: unknown; calendarExtraction?: unknown },
): ThreadBotConfig {
  const { expenseTracking: _expense, calendarExtraction: _calendar, ...config } = raw;
  return withoutStaleStorageLinks({
    ...config,
    directInteraction: normalizeDirectInteraction(config.directInteraction),
    chatMemory: normalizeChatMemoryConfig(config.chatMemory),
  });
}

export function createDefaultThreadConfig(
  threadId: string,
  params?: {
    threadName?: string;
    threadType?: 'user' | 'group';
    isListened?: boolean;
  },
): ThreadBotConfig {
  const isGroup = params?.threadType === 'group' || hasLegacyGroupPrefix(threadId);
  const safeName = params?.threadName ? sanitizePathSegment(params.threadName) : threadId;

  return {
    threadId,
    threadName: params?.threadName,
    threadType: params?.threadType || (isGroup ? 'group' : 'user'),
    isListened: params?.isListened ?? false,
    directInteraction: {
      enabled: false,
      triggerPrefixes: [],
      allowAiChat: false,
      allowSelf: false,
    },
    mediaBackup: {
      enabled: false,
      uploadImages: false,
      uploadVideos: false,
      uploadFiles: false,
      uploadAudios: false,
      notifyInThread: false,
      customFolder: params?.threadName ? `zalobot/${safeName}` : '',
      fileSuffix: safeName ? `_${safeName}` : '',
    },
    confirmationRules: {
      allowReactions: false,
      requiredHearts: isGroup ? 5 : 1,
      timeoutMinutes: 5,
    },
    chatMemory: { ...CHAT_MEMORY_DEFAULTS },
    updatedAt: Date.now(),
  };
}

export function entityToConfig(entity: ZcaThreadConfigEntity): ThreadBotConfig {
  return withoutStaleStorageLinks({
    threadId: entity.threadId,
    threadName: entity.threadName || undefined,
    threadType: entity.threadType || 'user',
    isListened: Boolean(entity.isListened),
    driveFolderId: entity.driveFolderId || undefined,
    driveFolderUrl: entity.driveFolderUrl || undefined,
    driveFolderPath: entity.driveFolderPath || undefined,
    photosAlbumId: entity.photosAlbumId || undefined,
    photosAlbumUrl: entity.photosAlbumUrl || undefined,
    photosAlbumTitle: entity.photosAlbumTitle || undefined,
    directInteraction: normalizeDirectInteraction(entity.directInteraction),
    mediaBackup: {
      enabled: entity.mediaBackup?.enabled ?? false,
      uploadImages: entity.mediaBackup?.uploadImages ?? false,
      uploadVideos: entity.mediaBackup?.uploadVideos ?? false,
      uploadFiles: entity.mediaBackup?.uploadFiles ?? false,
      uploadAudios: entity.mediaBackup?.uploadAudios ?? false,
      notifyInThread: entity.mediaBackup?.notifyInThread ?? false,
      customFolder: entity.mediaBackup?.customFolder || '',
      fileSuffix: entity.mediaBackup?.fileSuffix || '',
      photosAlbum: entity.mediaBackup?.photosAlbum || '',
    },
    confirmationRules: {
      allowReactions: entity.confirmationRules?.allowReactions ?? false,
      requiredHearts:
        entity.confirmationRules?.requiredHearts ?? (entity.threadType === 'group' ? 5 : 1),
      timeoutMinutes: entity.confirmationRules?.timeoutMinutes ?? 5,
    },
    chatMemory: normalizeChatMemoryConfig(entity.chatMemory),
    updatedAt: entity.updatedAt ? new Date(entity.updatedAt).getTime() : Date.now(),
  });
}

@Injectable()
export class ThreadConfigService implements OnModuleInit {
  private readonly logger = new Logger(ThreadConfigService.name);
  private readonly configsFilePath: string;
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
      process.env.DATA_DIR;

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
  }

  public async onModuleInit(): Promise<void> {
    await this.loadConfigs();
    if (
      this.redisService &&
      typeof (this.redisService as unknown as { onReady?: (cb: () => Promise<void>) => void })
        .onReady === 'function'
    ) {
      (this.redisService as unknown as { onReady: (cb: () => Promise<void>) => void }).onReady(
        async () => {
          await this.syncToRedis();
        },
      );
    }
  }

  public async syncToRedis(): Promise<void> {
    if (!this.redisService?.isReady) return;
    try {
      await this.syncListenedThreadsToRedis();
      for (const [, cfg] of this.configsMap.entries()) {
        await this.cacheConfigToRedis(cfg);
      }
      this.logger.log(`[ThreadConfigService] Synced configs and whitelist to Redis.`);
    } catch (err) {
      this.logger.warn(
        `[ThreadConfigService] Failed to sync configs to Redis: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
            for (const [id, storedConfig] of Object.entries(parsed)) {
              if (id === 'thread-123' || storedConfig.threadId === 'thread-123') continue;
              const config = normalizeCachedConfig(storedConfig);
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
      await this.syncToRedis();

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
  }

  public async getConfig(threadId: string, meta?: ThreadConfigMeta): Promise<ThreadBotConfig> {
    const id = String(threadId).trim();
    let config = await this.loadStoredConfig(id);

    if (!config) {
      config = createDefaultThreadConfig(id, {
        threadName: meta?.threadName,
        threadType: meta?.threadType,
        isListened: false,
      });
      this.configsMap.set(id, config);
      await this.saveConfigToDb(config);
      await this.cacheConfigToRedis(config);
      return config;
    }

    const nameChanged = Boolean(meta?.threadName) && config.threadName !== meta?.threadName;
    // Callers pass `threadType` only when they know it from zca-js (message/reaction/thread list),
    // so it overrides a type that was guessed from the id when the config was first created.
    const typeChanged = Boolean(meta?.threadType) && config.threadType !== meta?.threadType;
    if (nameChanged || typeChanged) {
      if (nameChanged) config.threadName = meta?.threadName;
      if (typeChanged && meta?.threadType) config.threadType = meta.threadType;
      config.updatedAt = Date.now();
      await this.saveConfigToDb(config);
      await this.cacheConfigToRedis(config);
    }

    return config;
  }

  /**
   * Corrects stored `threadType` for threads that already have a config, using the authoritative
   * ZCA thread list. Never creates configs. Returns how many configs were fixed.
   */
  public async reconcileThreadTypes(
    threads: ReadonlyArray<{ id: string; type: ThreadKind }>,
  ): Promise<number> {
    let fixed = 0;
    for (const thread of threads) {
      const id = String(thread.id).trim();
      if (!id || id === 'thread-123') continue;
      const config = await this.loadStoredConfig(id);
      if (!config || config.threadType === thread.type) continue;
      config.threadType = thread.type;
      config.updatedAt = Date.now();
      await this.saveConfigToDb(config);
      await this.cacheConfigToRedis(config);
      fixed++;
    }
    if (fixed > 0) {
      this.logger.log(`[ThreadConfigService] Reconciled threadType for ${fixed} thread configs.`);
    }
    return fixed;
  }

  /** Read-only lookup of a thread's saved config; unlike `getConfig` it never creates a default one. */
  /** Storage target of a thread; channels without a stored config use the default target. */
  public async getStorageTarget(threadId: string): Promise<ChannelStorageTarget> {
    const stored = await this.findStoredConfig(threadId);
    return stored ? getThreadStorageTarget(stored) : buildChannelStorageTarget(String(threadId));
  }

  public async findStoredConfig(threadId: string): Promise<ThreadBotConfig | undefined> {
    return this.loadStoredConfig(String(threadId).trim());
  }

  /** Stored config lookup (memory → Redis → DB); warms memory/Redis, never creates a config. */
  private async loadStoredConfig(id: string): Promise<ThreadBotConfig | undefined> {
    const inMemory = this.configsMap.get(id);
    if (inMemory) return inMemory;

    if (this.redisService?.isReady) {
      try {
        const cachedRaw = await this.redisService.get(`${REDIS_KEY_THREAD_CONFIG_PREFIX}${id}`);
        if (cachedRaw) {
          const config = normalizeCachedConfig(JSON.parse(cachedRaw) as ThreadBotConfig);
          this.configsMap.set(id, config);
          return config;
        }
      } catch {
        // Continue to DB check
      }
    }

    if (this.threadConfigRepo) {
      try {
        const entity = await this.threadConfigRepo.findOneBy({ threadId: id });
        if (entity) {
          const config = entityToConfig(entity);
          this.configsMap.set(id, config);
          await this.cacheConfigToRedis(config);
          return config;
        }
      } catch (err) {
        this.logger.warn(
          `[ThreadConfigService] DB findOneBy failed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return undefined;
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

  /**
   * Whether a channel id is a group chat. Trusts the stored thread config (memory → Redis → DB)
   * and never creates a config; falls back to the legacy id prefix only when nothing is stored.
   */
  public async isGroupThread(threadId: string): Promise<boolean> {
    const id = String(threadId).trim();
    if (!id) return false;

    const cached = this.configsMap.get(id);
    if (cached) return cached.threadType === 'group';

    if (this.redisService?.isReady) {
      try {
        const cachedRaw = await this.redisService.get(`${REDIS_KEY_THREAD_CONFIG_PREFIX}${id}`);
        if (cachedRaw) {
          const parsed: unknown = JSON.parse(cachedRaw);
          if (parsed && typeof parsed === 'object' && 'threadType' in parsed) {
            return parsed.threadType === 'group';
          }
        }
      } catch {
        // Continue to DB check
      }
    }

    if (this.threadConfigRepo && typeof this.threadConfigRepo.findOneBy === 'function') {
      try {
        const entity = await this.threadConfigRepo.findOneBy({ threadId: id });
        if (entity) return entity.threadType === 'group';
      } catch {
        // Continue to legacy fallback
      }
    }

    return hasLegacyGroupPrefix(id);
  }

  public async isThreadListened(threadId: string): Promise<boolean> {
    const id = String(threadId).trim();
    if (!id || id === 'thread-123') return false;

    // 1. Fast check in-memory map (guaranteed up-to-date once loaded)
    const cfg = this.configsMap.get(id);
    if (cfg !== undefined) {
      return Boolean(cfg.isListened);
    }

    // 2. Fast check via Redis
    if (this.redisService?.isReady) {
      const isMember = await this.redisService.sismember(REDIS_KEY_LISTENED_THREADS, id);
      if (isMember) return true;
    }

    // 3. Fallback to PostgreSQL DB if not found in memory
    if (this.threadConfigRepo) {
      try {
        const entity = await this.threadConfigRepo.findOneBy({ threadId: id });
        if (entity) {
          const loadedCfg = entityToConfig(entity);
          this.configsMap.set(id, loadedCfg);
          await this.cacheConfigToRedis(loadedCfg);
          return Boolean(loadedCfg.isListened);
        }
      } catch {
        // Continue
      }
    }

    return false;
  }

  public async updateConfig(
    threadId: string,
    update: UpdateThreadBotConfigDto,
    meta?: ThreadConfigMeta,
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

    if (update.driveFolderId !== undefined) {
      config.driveFolderId = update.driveFolderId;
    }

    if (update.driveFolderUrl !== undefined) {
      config.driveFolderUrl = update.driveFolderUrl;
    }

    if (update.driveFolderPath !== undefined) {
      config.driveFolderPath = update.driveFolderPath;
    }

    if (update.photosAlbumId !== undefined) {
      config.photosAlbumId = update.photosAlbumId;
    }

    if (update.photosAlbumUrl !== undefined) {
      config.photosAlbumUrl = update.photosAlbumUrl;
    }

    if (update.photosAlbumTitle !== undefined) {
      config.photosAlbumTitle = update.photosAlbumTitle;
    }

    if (update.directInteraction) {
      config.directInteraction = normalizeDirectInteraction({
        ...config.directInteraction,
        ...update.directInteraction,
      });
    }

    if (update.mediaBackup) {
      config.mediaBackup = {
        ...config.mediaBackup,
        ...update.mediaBackup,
      };
    }

    if (update.confirmationRules) {
      config.confirmationRules = {
        ...config.confirmationRules,
        ...update.confirmationRules,
      };
    }

    if (update.chatMemory) {
      config.chatMemory = normalizeChatMemoryConfig({
        ...config.chatMemory,
        ...update.chatMemory,
      });
    }

    // The dashboard echoes stored links back, so re-check them against the (maybe changed)
    // customFolder / photosAlbum before persisting.
    Object.assign(config, withoutStaleStorageLinks(config));
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

    return config;
  }

  public async setListened(
    threadId: string,
    isListened: boolean,
    meta?: ThreadConfigMeta,
  ): Promise<ThreadBotConfig> {
    const config = await this.getConfig(threadId, meta);
    const directInteraction =
      isListened && !config.directInteraction?.enabled
        ? {
            enabled: true,
            triggerPrefixes: config.directInteraction?.triggerPrefixes ?? [],
            allowAiChat: true,
            allowSelf: config.directInteraction?.allowSelf ?? false,
          }
        : undefined;

    return this.updateConfig(threadId, {
      isListened,
      ...(directInteraction ? { directInteraction } : {}),
    });
  }

  /**
   * Removes a thread's config from DB, Redis, memory and the listened set. Chat memory and the
   * Drive/Photos link history stay. Returns false when the thread has no stored config.
   */
  public async deleteConfig(threadId: string): Promise<boolean> {
    const id = String(threadId).trim();
    const stored = await this.loadStoredConfig(id);
    if (!stored) return false;

    // DB first: if it fails nothing else is touched and the caller sees the error.
    if (this.threadConfigRepo) {
      const entity = await this.threadConfigRepo.findOneBy({ threadId: id });
      // `remove` (not `delete`) so AuditLogSubscriber records the deleted row.
      if (entity) await this.threadConfigRepo.remove(entity);
    }
    this.configsMap.delete(id);
    await this.redisService?.del(`${REDIS_KEY_THREAD_CONFIG_PREFIX}${id}`);
    await this.syncListenedThreadsToRedis();
    this.logger.log(`[ThreadConfigService] Deleted thread config ${id}.`);
    return true;
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
          confirmationRules: config.confirmationRules,
          chatMemory: config.chatMemory,
          driveFolderId: config.driveFolderId,
          driveFolderUrl: config.driveFolderUrl,
          driveFolderPath: config.driveFolderPath,
          photosAlbumId: config.photosAlbumId,
          photosAlbumUrl: config.photosAlbumUrl,
          photosAlbumTitle: config.photosAlbumTitle,
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

  public async saveDriveFolderInfo(
    threadId: string,
    folderInfo: { folderId?: string; folderUrl?: string; folderPath?: string },
  ): Promise<void> {
    const stored = await this.findStoredConfig(threadId);
    const driveRoot = stored ? getThreadDriveRoot(stored) : resolveChannelDriveRoot(threadId);
    if (!isSameDrivePath(folderInfo.folderPath, driveRoot)) {
      // Links must point at the channel root, not the month sub-folder of the last upload.
      this.logger.debug(
        `[ThreadConfigService] Ignoring Drive folder "${folderInfo.folderPath ?? ''}" for thread ${threadId}: channel root is "${driveRoot}".`,
      );
      return;
    }

    const config = this.configsMap.get(threadId);
    if (config) {
      if (folderInfo.folderId !== undefined) config.driveFolderId = folderInfo.folderId;
      if (folderInfo.folderUrl !== undefined) config.driveFolderUrl = folderInfo.folderUrl;
      if (folderInfo.folderPath !== undefined) config.driveFolderPath = folderInfo.folderPath;
      await this.cacheConfigToRedis(config);
    }

    if (this.threadConfigRepo && typeof this.threadConfigRepo.findOne === 'function') {
      try {
        let entity = await this.threadConfigRepo.findOne({ where: { threadId } });
        if (!entity && typeof this.threadConfigRepo.create === 'function') {
          entity = this.threadConfigRepo.create({
            threadId,
            threadType: (await this.isGroupThread(threadId)) ? 'group' : 'user',
            isListened: false,
          });
        }
        if (entity) {
          if (folderInfo.folderId !== undefined) entity.driveFolderId = folderInfo.folderId;
          if (folderInfo.folderUrl !== undefined) entity.driveFolderUrl = folderInfo.folderUrl;
          if (folderInfo.folderPath !== undefined) entity.driveFolderPath = folderInfo.folderPath;
          if (typeof this.threadConfigRepo.save === 'function') {
            await this.threadConfigRepo.save(entity);
          }
        }
      } catch (err) {
        this.logger.warn(
          `[ThreadConfigService] Could not save Drive folder info to DB for thread ${threadId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  public async savePhotosAlbumInfo(
    threadId: string,
    albumInfo: { albumId?: string; albumUrl?: string; albumTitle?: string },
  ): Promise<void> {
    const stored = await this.findStoredConfig(threadId);
    const albumTitle = stored ? getThreadPhotosAlbumTitle(stored) : undefined;
    if (
      albumTitle &&
      albumInfo.albumTitle !== undefined &&
      albumInfo.albumTitle.trim() !== albumTitle
    ) {
      this.logger.debug(
        `[ThreadConfigService] Ignoring Photos album "${albumInfo.albumTitle}" for thread ${threadId}: channel album is "${albumTitle}".`,
      );
      return;
    }

    const config = this.configsMap.get(threadId);
    if (config) {
      if (albumInfo.albumId !== undefined) config.photosAlbumId = albumInfo.albumId;
      if (albumInfo.albumUrl !== undefined) config.photosAlbumUrl = albumInfo.albumUrl;
      if (albumInfo.albumTitle !== undefined) config.photosAlbumTitle = albumInfo.albumTitle;
      await this.cacheConfigToRedis(config);
    }

    if (this.threadConfigRepo && typeof this.threadConfigRepo.findOne === 'function') {
      try {
        let entity = await this.threadConfigRepo.findOne({ where: { threadId } });
        if (!entity && typeof this.threadConfigRepo.create === 'function') {
          entity = this.threadConfigRepo.create({
            threadId,
            threadType: (await this.isGroupThread(threadId)) ? 'group' : 'user',
            isListened: false,
          });
        }
        if (entity) {
          if (albumInfo.albumId !== undefined) entity.photosAlbumId = albumInfo.albumId;
          if (albumInfo.albumUrl !== undefined) entity.photosAlbumUrl = albumInfo.albumUrl;
          if (albumInfo.albumTitle !== undefined) entity.photosAlbumTitle = albumInfo.albumTitle;
          if (typeof this.threadConfigRepo.save === 'function') {
            await this.threadConfigRepo.save(entity);
          }
        }
      } catch (err) {
        this.logger.warn(
          `[ThreadConfigService] Could not save Photos album info to DB for thread ${threadId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
