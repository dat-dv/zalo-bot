import test from 'node:test';
import assert from 'node:assert/strict';
import type { Repository } from 'typeorm';
import type { RedisService } from '../redis/redis.service';
import type { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import {
  ThreadConfigService,
  createDefaultThreadConfig,
  sanitizePathSegment,
} from './thread-config.service';

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
  assert.equal(groupConfig.directInteraction.requireMention, true);
  assert.equal(groupConfig.directInteraction.allowAiChat, false);
  assert.equal(groupConfig.directInteraction.allowSelf, false);
  assert.equal(groupConfig.mediaBackup.enabled, false);
  assert.equal(groupConfig.mediaBackup.uploadImages, false);
  assert.equal(groupConfig.mediaBackup.uploadVideos, false);
  assert.equal(groupConfig.expenseTracking.enabled, false);
  assert.equal(groupConfig.expenseTracking.requireConfirm, false);
  assert.equal(groupConfig.calendarExtraction.enabled, false);
  assert.equal(groupConfig.calendarExtraction.requireConfirm, false);
  assert.equal(groupConfig.confirmationRules.allowReactions, false);
  assert.equal(groupConfig.mediaBackup.fileSuffix, '_team_dev');
  assert.equal(groupConfig.confirmationRules.requiredHearts, 5);

  const userConfig = createDefaultThreadConfig('u-789', {
    threadName: 'Nguyễn Văn A',
    threadType: 'user',
  });
  assert.equal(userConfig.threadType, 'user');
  assert.equal(userConfig.confirmationRules.requiredHearts, 1);
  assert.equal(userConfig.directInteraction.enabled, false);
  assert.equal(userConfig.directInteraction.requireMention, false);
  assert.equal(userConfig.expenseTracking.enabled, false);
  assert.equal(userConfig.calendarExtraction.enabled, false);
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
    expenseTracking: {
      enabled: true,
      requireConfirm: false,
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
  assert.equal(updated.expenseTracking.requireConfirm, false);
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
    findOneBy: () => Promise.resolve(null),
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
});
