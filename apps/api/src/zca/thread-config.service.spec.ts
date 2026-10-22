import test from 'node:test';
import assert from 'node:assert/strict';
import type { Repository } from 'typeorm';
import type { RedisService } from '../redis/redis.service';
import type { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import {
  ThreadConfigService,
  createDefaultThreadConfig,
  normalizeDirectInteraction,
  sanitizePathSegment,
  withoutStaleStorageLinks,
} from './thread-config.service';
import { normalizeChatMemoryConfig } from '@zalobot/contracts';

void test('sanitizePathSegment cleans Vietnamese diacritics and special characters', () => {
  assert.equal(sanitizePathSegment('Nhóm Kế Toán & Thu Chi'), 'nhom_ke_toan_thu_chi');
  assert.equal(sanitizePathSegment('Đoàn Trí (Gia Đình)'), 'doan_tri_gia_dinh');
});

void test('createDefaultThreadConfig creates sensible defaults for group vs user', () => {
  const groupConfig = createDefaultThreadConfig('g-123456', {
    threadName: 'Team Dev',
    threadType: 'group',
  });
  assert.equal(groupConfig.threadId, 'g-123456');
  assert.equal(groupConfig.threadType, 'group');
  assert.equal(groupConfig.isListened, false);
  assert.equal(groupConfig.directInteraction.enabled, false);
  assert.deepEqual(groupConfig.directInteraction.triggerPrefixes, []);
  assert.equal(groupConfig.directInteraction.allowAiChat, false);
  assert.equal(groupConfig.directInteraction.allowSelf, false);
  assert.equal(groupConfig.mediaBackup.enabled, false);
  assert.equal(groupConfig.mediaBackup.uploadImages, false);
  assert.equal(groupConfig.mediaBackup.uploadVideos, false);
  assert.equal(groupConfig.mediaBackup.uploadFiles, false);
  assert.equal(groupConfig.mediaBackup.uploadAudios, false);
  assert.equal(groupConfig.mediaBackup.notifyInThread, false);
  assert.equal(groupConfig.confirmationRules.allowReactions, false);
  assert.equal(groupConfig.mediaBackup.fileSuffix, '_team_dev');
  assert.equal(groupConfig.confirmationRules.requiredHearts, 5);
  assert.deepEqual(groupConfig.chatMemory, { enabled: false, contextWindow: 10, searchLimit: 15 });

  const userConfig = createDefaultThreadConfig('u-789', {
    threadName: 'Nguyễn Văn A',
    threadType: 'user',
  });
  assert.equal(userConfig.threadType, 'user');
  assert.equal(userConfig.confirmationRules.requiredHearts, 1);
  assert.equal(userConfig.directInteraction.enabled, false);
  assert.ok(!('expenseTracking' in userConfig));
  assert.equal(userConfig.confirmationRules.allowReactions, false);
});

void test('ThreadConfigService updates and retrieves thread configs', async () => {
  const service = new ThreadConfigService();
  const threadId = `test-${Date.now()}`;

  const config = await service.getConfig(threadId, {
    threadName: 'Phòng Dự Án',
    threadType: 'group',
  });
  assert.equal(config.threadId, threadId);
  assert.equal(config.mediaBackup.enabled, false);

  const updated = await service.updateConfig(threadId, {
    isListened: true,
    mediaBackup: {
      enabled: true,
      fileSuffix: '_duan_x',
      customFolder: 'zalobot/DuanX',
    },
    confirmationRules: {
      allowReactions: true,
      requiredHearts: 3,
      timeoutMinutes: 10,
    },
  });

  assert.equal(updated.isListened, true);
  assert.equal(updated.mediaBackup.enabled, true);
  assert.equal(updated.mediaBackup.fileSuffix, '_duan_x');
  assert.equal(updated.mediaBackup.customFolder, 'zalobot/DuanX');
  assert.equal(updated.confirmationRules.requiredHearts, 3);
  assert.equal(updated.confirmationRules.timeoutMinutes, 10);

  const listenedIds = service.getListenedThreadIds();
  assert.ok(listenedIds.includes(threadId));
});

void test('ThreadConfigService persists to DB repo and syncs to Redis', async () => {
  const upserted: Partial<ZcaThreadConfigEntity>[] = [];
  const redisSetMap = new Map<string, string>();
  const redisMembers = new Set<string>();

  const mockRepo = {
    find: () => Promise.resolve([] as ZcaThreadConfigEntity[]),
    findOne: () => Promise.resolve(null),
    findOneBy: () => Promise.resolve(null),
    create: (dto: Partial<ZcaThreadConfigEntity>) => dto as ZcaThreadConfigEntity,
    save: (entity: ZcaThreadConfigEntity) => {
      upserted.push(entity);
      return Promise.resolve(entity);
    },
    upsert: (entity: Partial<ZcaThreadConfigEntity>) => {
      upserted.push(entity);
      return Promise.resolve({ identifiers: [], generatedMaps: [], raw: [] });
    },
  } as unknown as Repository<ZcaThreadConfigEntity>;

  const mockRedis = {
    isReady: true,
    get: (key: string) => Promise.resolve(redisSetMap.get(key) ?? null),
    set: (key: string, val: string) => {
      redisSetMap.set(key, val);
      return Promise.resolve(true);
    },
    sadd: (_key: string, ...members: string[]) => {
      members.forEach((m) => redisMembers.add(m));
      return Promise.resolve(members.length);
    },
    srem: (_key: string, ...members: string[]) => {
      members.forEach((m) => redisMembers.delete(m));
      return Promise.resolve(members.length);
    },
    smembers: () => Promise.resolve(Array.from(redisMembers)),
    sismember: (_key: string, member: string) => Promise.resolve(redisMembers.has(member)),
  } as unknown as RedisService;

  const service = new ThreadConfigService(mockRepo, mockRedis);
  await service.onModuleInit();

  const testId = 'real-user-5854445174804412080';
  const cfg = await service.getConfig(testId, { threadName: 'Dat Doan', threadType: 'user' });
  assert.equal(cfg.threadId, testId);
  assert.equal(cfg.threadName, 'Dat Doan');

  // Verify upsert was called
  assert.ok(upserted.some((u) => u.threadId === testId));

  // Enable listen
  await service.setListened(testId, true);
  assert.ok(redisMembers.has(testId));
  assert.equal(await service.isThreadListened(testId), true);

  // Disable listen
  await service.setListened(testId, false);
  assert.equal(redisMembers.has(testId), false);
  assert.equal(await service.isThreadListened(testId), false);

  // thread-123 is never added
  await service.setListened('thread-123', true);
  assert.equal(await service.isThreadListened('thread-123'), false);
  assert.equal(service.getListenedThreadIds().includes('thread-123'), false);

  // Test savePhotosAlbumInfo
  await service.savePhotosAlbumInfo(testId, {
    albumId: 'album_abc_123',
    albumUrl: 'https://photos.google.com/album/custom-album',
    albumTitle: '[Zalo] Dat Doan',
  });
  const updatedCfg = await service.getConfig(testId);
  assert.equal(updatedCfg.photosAlbumId, 'album_abc_123');
  assert.equal(updatedCfg.photosAlbumUrl, 'https://photos.google.com/album/custom-album');
  assert.equal(updatedCfg.photosAlbumTitle, '[Zalo] Dat Doan');
});

void test('ThreadConfigService registers onReady and syncs listened DB records to Redis', async () => {
  const dbRecords: Partial<ZcaThreadConfigEntity>[] = [
    {
      threadId: 'group-101',
      threadName: 'Group 101',
      threadType: 'group',
      isListened: true,
    },
    {
      threadId: 'group-102',
      threadName: 'Group 102',
      threadType: 'group',
      isListened: false,
    },
  ];

  const redisMembers = new Set<string>();
  let readyCallback: (() => Promise<void>) | null = null;
  let isRedisReady = false;

  const mockRepo = {
    find: () => Promise.resolve(dbRecords as ZcaThreadConfigEntity[]),
    findOne: () => Promise.resolve(null),
    findOneBy: () => Promise.resolve(null),
  } as unknown as Repository<ZcaThreadConfigEntity>;

  const mockRedis = {
    get isReady() {
      return isRedisReady;
    },
    onReady: (cb: () => Promise<void>) => {
      readyCallback = cb;
    },
    sadd: (_key: string, ...members: string[]) => {
      members.forEach((m) => redisMembers.add(m));
      return Promise.resolve(members.length);
    },
    sismember: (_key: string, member: string) => Promise.resolve(redisMembers.has(member)),
    smembers: () => Promise.resolve(Array.from(redisMembers)),
  } as unknown as RedisService;

  const service = new ThreadConfigService(mockRepo, mockRedis);

  // During onModuleInit, redis is not ready yet
  await service.onModuleInit();
  assert.equal(readyCallback !== null, true);
  assert.equal(redisMembers.size, 0); // Not synced yet because isReady was false

  // Now Redis connects and triggers onReady
  isRedisReady = true;
  await readyCallback();

  // Group 101 should be synced to Redis, Group 102 should NOT
  assert.equal(redisMembers.has('group-101'), true);
  assert.equal(redisMembers.has('group-102'), false);
  assert.equal(await service.isThreadListened('group-101'), true);
  assert.equal(await service.isThreadListened('group-102'), false);
});

void test('ThreadConfigService.isGroupThread trusts stored thread type over id prefix', async () => {
  const mockRepo = {
    findOneBy: ({ threadId }: { threadId: string }) =>
      Promise.resolve(
        threadId === '7120342145544273834'
          ? ({ threadId, threadType: 'group', isListened: true } as ZcaThreadConfigEntity)
          : null,
      ),
  } as unknown as Repository<ZcaThreadConfigEntity>;
  const service = new ThreadConfigService(mockRepo);

  assert.equal(await service.isGroupThread('7120342145544273834'), true);
  assert.equal(await service.isGroupThread('1234567890123456789'), false);
  assert.equal(await service.isGroupThread('g-legacy'), true);
  assert.equal(await service.isGroupThread('group_legacy'), true);
});

function createStoreMocks(seed: Partial<ZcaThreadConfigEntity>[] = []): {
  repo: Repository<ZcaThreadConfigEntity>;
  redis: RedisService;
  rows: Map<string, Partial<ZcaThreadConfigEntity>>;
  redisValues: Map<string, string>;
  removed: Partial<ZcaThreadConfigEntity>[];
} {
  const rows = new Map<string, Partial<ZcaThreadConfigEntity>>();
  for (const row of seed) if (row.threadId) rows.set(row.threadId, row);
  const redisValues = new Map<string, string>();
  const removed: Partial<ZcaThreadConfigEntity>[] = [];

  const repo = {
    find: () => Promise.resolve(Array.from(rows.values())),
    findOneBy: ({ threadId }: { threadId: string }) => Promise.resolve(rows.get(threadId) ?? null),
    upsert: (entity: Partial<ZcaThreadConfigEntity>) => {
      if (entity.threadId) rows.set(entity.threadId, { ...rows.get(entity.threadId), ...entity });
      return Promise.resolve({ identifiers: [], generatedMaps: [], raw: [] });
    },
    remove: (entity: Partial<ZcaThreadConfigEntity>) => {
      if (entity.threadId) rows.delete(entity.threadId);
      removed.push(entity);
      return Promise.resolve(entity);
    },
  } as unknown as Repository<ZcaThreadConfigEntity>;

  const redis = {
    isReady: true,
    get: (key: string) => Promise.resolve(redisValues.get(key) ?? null),
    set: (key: string, val: string) => {
      redisValues.set(key, val);
      return Promise.resolve(true);
    },
    del: (key: string) => Promise.resolve(redisValues.delete(key)),
    sadd: (_key: string, ...members: string[]) => Promise.resolve(members.length),
    srem: (_key: string, ...members: string[]) => Promise.resolve(members.length),
  } as unknown as RedisService;

  return { repo, redis, rows, redisValues, removed };
}

function cachedThreadType(redisValues: Map<string, string>, threadId: string): unknown {
  const raw = redisValues.get(`zca:thread_config:${threadId}`);
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && 'threadType' in parsed
    ? parsed.threadType
    : undefined;
}

const NUMERIC_GROUP_ID = '7120342145544273834';

void test('getConfig stores a numeric ZCA group id as group when meta says so', async () => {
  const { repo, redis, rows, redisValues } = createStoreMocks();
  const service = new ThreadConfigService(repo, redis);

  const config = await service.getConfig(NUMERIC_GROUP_ID, { threadType: 'group' });

  assert.equal(config.threadType, 'group');
  assert.equal(config.confirmationRules.requiredHearts, 5);
  assert.equal(rows.get(NUMERIC_GROUP_ID)?.threadType, 'group');
  assert.equal(cachedThreadType(redisValues, NUMERIC_GROUP_ID), 'group');
});

void test('getConfig corrects a group stored as user without a thread name change', async () => {
  const { repo, redis, rows, redisValues } = createStoreMocks([
    { threadId: NUMERIC_GROUP_ID, threadName: 'Team', threadType: 'user', isListened: true },
  ]);
  const service = new ThreadConfigService(repo, redis);

  const config = await service.getConfig(NUMERIC_GROUP_ID, { threadType: 'group' });

  assert.equal(config.threadType, 'group');
  assert.equal(config.threadName, 'Team');
  assert.equal(rows.get(NUMERIC_GROUP_ID)?.threadType, 'group');
  assert.equal(cachedThreadType(redisValues, NUMERIC_GROUP_ID), 'group');
  assert.equal(await service.isGroupThread(NUMERIC_GROUP_ID), true);
});

void test('setListened passes thread type meta to the default config', async () => {
  const { repo, redis, rows } = createStoreMocks();
  const service = new ThreadConfigService(repo, redis);

  const config = await service.setListened(NUMERIC_GROUP_ID, true, { threadType: 'group' });

  assert.equal(config.threadType, 'group');
  assert.equal(config.isListened, true);
  assert.equal(rows.get(NUMERIC_GROUP_ID)?.threadType, 'group');
});

void test('reconcileThreadTypes fixes wrong stored types and never creates configs', async () => {
  const { repo, redis, rows, redisValues } = createStoreMocks([
    { threadId: NUMERIC_GROUP_ID, threadType: 'user', isListened: true },
    { threadId: '5854445174804412080', threadType: 'user', isListened: true },
  ]);
  const service = new ThreadConfigService(repo, redis);

  const fixed = await service.reconcileThreadTypes([
    { id: NUMERIC_GROUP_ID, type: 'group' },
    { id: '5854445174804412080', type: 'user' },
    { id: '9999999999999999999', type: 'group' },
  ]);

  assert.equal(fixed, 1);
  assert.equal(rows.get(NUMERIC_GROUP_ID)?.threadType, 'group');
  assert.equal(cachedThreadType(redisValues, NUMERIC_GROUP_ID), 'group');
  assert.equal(rows.get('5854445174804412080')?.threadType, 'user');
  assert.equal(rows.has('9999999999999999999'), false);
  assert.equal(service.getConfigSync('9999999999999999999'), undefined);
});

void test('normalizeDirectInteraction folds the legacy single prefix and drops requireMention', () => {
  const normalized = normalizeDirectInteraction({
    enabled: true,
    triggerPrefix: '!',
    requireMention: false,
    allowAiChat: true,
  });
  assert.deepEqual(normalized, {
    enabled: true,
    triggerPrefixes: ['!'],
    allowAiChat: true,
    allowSelf: false,
  });
});

void test('ThreadConfigService stores a cleaned prefix list on update', async () => {
  const service = new ThreadConfigService();
  const threadId = `prefix-${Date.now()}`;
  const updated = await service.updateConfig(threadId, {
    directInteraction: { triggerPrefixes: ['!', ' bot: ', 'BOT:', 'có dấu cách', ''] },
  });
  assert.deepEqual(updated.directInteraction.triggerPrefixes, ['bot:', '!']);
});

void test('withoutStaleStorageLinks drops a Drive link that is not the channel root', () => {
  const base = createDefaultThreadConfig('123', { threadName: 'Team Dev', threadType: 'group' });
  const leaf = withoutStaleStorageLinks({
    ...base,
    driveFolderId: 'leaf',
    driveFolderUrl: 'https://drive.google.com/drive/folders/leaf',
    driveFolderPath: 'zalobot/team_dev/2026-10',
  });
  assert.equal(leaf.driveFolderUrl, undefined);
  assert.equal(leaf.driveFolderId, undefined);
  assert.equal(leaf.driveFolderPath, undefined);

  const root = withoutStaleStorageLinks({
    ...base,
    driveFolderUrl: 'https://drive.google.com/drive/folders/root',
    driveFolderPath: 'zalobot/team_dev',
  });
  assert.equal(root.driveFolderUrl, 'https://drive.google.com/drive/folders/root');
});

void test('withoutStaleStorageLinks drops a Photos album that differs from the photosAlbum override', () => {
  const base = createDefaultThreadConfig('123', { threadName: 'Team Dev', threadType: 'group' });
  const stale = withoutStaleStorageLinks({
    ...base,
    mediaBackup: { ...base.mediaBackup, photosAlbum: 'Album mới' },
    photosAlbumId: 'old',
    photosAlbumUrl: 'https://photos.google.com/album/old',
    photosAlbumTitle: '[Zalo] Team Dev',
  });
  assert.equal(stale.photosAlbumId, undefined);
  assert.equal(stale.photosAlbumUrl, undefined);
  assert.equal(stale.photosAlbumTitle, undefined);

  const kept = withoutStaleStorageLinks({
    ...base,
    photosAlbumUrl: 'https://photos.google.com/album/current',
    photosAlbumTitle: '[Zalo] Team Dev',
  });
  assert.equal(kept.photosAlbumUrl, 'https://photos.google.com/album/current');
});

void test('saveDriveFolderInfo only stores the channel root folder', async () => {
  const service = new ThreadConfigService();
  await service.getConfig('555', { threadName: 'Team Dev', threadType: 'group' });

  await service.saveDriveFolderInfo('555', {
    folderId: 'leaf',
    folderUrl: 'https://drive.google.com/drive/folders/leaf',
    folderPath: 'zalobot/team_dev/2026-10',
  });
  assert.equal(service.getConfigSync('555')?.driveFolderUrl, undefined);

  await service.saveDriveFolderInfo('555', {
    folderId: 'root',
    folderUrl: 'https://drive.google.com/drive/folders/root',
    folderPath: 'zalobot/team_dev',
  });
  assert.equal(
    service.getConfigSync('555')?.driveFolderUrl,
    'https://drive.google.com/drive/folders/root',
  );
});

void test('savePhotosAlbumInfo ignores an album other than the channel album', async () => {
  const service = new ThreadConfigService();
  await service.getConfig('556', { threadName: 'Team Dev', threadType: 'group' });

  await service.savePhotosAlbumInfo('556', {
    albumUrl: 'https://photos.google.com/album/other',
    albumTitle: 'ZaloBot - Hình ảnh',
  });
  assert.equal(service.getConfigSync('556')?.photosAlbumUrl, undefined);

  await service.savePhotosAlbumInfo('556', {
    albumUrl: 'https://photos.google.com/album/team',
    albumTitle: '[Zalo] Team Dev',
  });
  assert.equal(
    service.getConfigSync('556')?.photosAlbumUrl,
    'https://photos.google.com/album/team',
  );
});

void test('updateConfig clears stored links when customFolder or photosAlbum changes', async () => {
  const service = new ThreadConfigService();
  const cfg = await service.getConfig('557', { threadName: 'Team Dev', threadType: 'group' });
  await service.saveDriveFolderInfo('557', {
    folderUrl: 'https://drive.google.com/drive/folders/root',
    folderPath: 'zalobot/team_dev',
  });
  await service.savePhotosAlbumInfo('557', {
    albumUrl: 'https://photos.google.com/album/team',
    albumTitle: '[Zalo] Team Dev',
  });

  // The dashboard modal echoes the stored links back together with the new folder/album.
  const updated = await service.updateConfig('557', {
    driveFolderUrl: 'https://drive.google.com/drive/folders/root',
    driveFolderPath: 'zalobot/team_dev',
    photosAlbumUrl: 'https://photos.google.com/album/team',
    photosAlbumTitle: '[Zalo] Team Dev',
    mediaBackup: { ...cfg.mediaBackup, customFolder: 'zalobot/khac', photosAlbum: 'Album khác' },
  });
  assert.equal(updated.driveFolderUrl, undefined);
  assert.equal(updated.photosAlbumUrl, undefined);
});

void test('ThreadConfigService merges and clamps chat memory updates', async () => {
  const service = new ThreadConfigService();
  const threadId = `memory-config-${Date.now()}`;
  await service.getConfig(threadId, { threadType: 'group' });

  const enabled = await service.updateConfig(threadId, {
    chatMemory: { enabled: true, contextWindow: 99 },
  });
  assert.deepEqual(enabled.chatMemory, { enabled: true, contextWindow: 30, searchLimit: 15 });

  const tuned = await service.updateConfig(threadId, { chatMemory: { searchLimit: 0 } });
  assert.deepEqual(tuned.chatMemory, { enabled: true, contextWindow: 30, searchLimit: 1 });
});

void test('normalizeChatMemoryConfig fills defaults and rejects junk values', () => {
  assert.deepEqual(normalizeChatMemoryConfig(undefined), {
    enabled: false,
    contextWindow: 10,
    searchLimit: 15,
  });
  assert.deepEqual(
    normalizeChatMemoryConfig({ enabled: 'yes', contextWindow: '-3', searchLimit: 'abc' }),
    { enabled: false, contextWindow: 0, searchLimit: 15 },
  );
  assert.deepEqual(
    normalizeChatMemoryConfig({ enabled: true, contextWindow: 7.6, searchLimit: 80 }),
    {
      enabled: true,
      contextWindow: 8,
      searchLimit: 50,
    },
  );
});

void test('deleteConfig removes the row via remove(), the Redis cache and the listened state', async () => {
  const { repo, redis, rows, redisValues, removed } = createStoreMocks([
    { threadId: NUMERIC_GROUP_ID, threadType: 'group', isListened: true },
  ]);
  const service = new ThreadConfigService(repo, redis);
  await service.loadConfigs();
  assert.deepEqual(service.getListenedThreadIds(), [NUMERIC_GROUP_ID]);

  assert.equal(await service.deleteConfig(NUMERIC_GROUP_ID), true);

  assert.equal(rows.has(NUMERIC_GROUP_ID), false);
  assert.equal(removed.length, 1, 'remove() keeps the audit log subscriber in the loop');
  assert.equal(redisValues.has(`zca:thread_config:${NUMERIC_GROUP_ID}`), false);
  assert.equal(service.getConfigSync(NUMERIC_GROUP_ID), undefined);
  assert.deepEqual(service.getListenedThreadIds(), []);
});

void test('deleteConfig returns false and creates nothing for an unknown thread', async () => {
  const { repo, redis, rows } = createStoreMocks();
  const service = new ThreadConfigService(repo, redis);

  assert.equal(await service.deleteConfig('missing-thread'), false);
  assert.equal(rows.size, 0);
});
