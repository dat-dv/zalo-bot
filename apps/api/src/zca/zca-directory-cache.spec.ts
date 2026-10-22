import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ZcaService } from './zca.service';
import {
  ZCA_DIRECTORY_HARD_TTL_SECONDS,
  ZCA_DIRECTORY_SOFT_TTL_MS,
  zcaDirectoryRedisKey,
} from './zca.constants';
import {
  isZcaDirectoryStale,
  mergeZcaDirectory,
  parseZcaDirectorySnapshot,
  type ZcaDirectorySnapshot,
} from './zca-directory-cache';

const OWN_ID = 'own-1';

class FakeRedis extends RedisService {
  public readonly store = new Map<string, string>();
  public readonly ttls = new Map<string, number | undefined>();

  constructor() {
    super(new ConfigService({}));
  }

  public override get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  public override set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    this.store.set(key, value);
    this.ttls.set(key, ttlSeconds);
    return Promise.resolve(true);
  }

  public override del(key: string): Promise<boolean> {
    this.store.delete(key);
    return Promise.resolve(true);
  }
}

interface FakeZaloApi {
  calls: number;
  failFriends: boolean;
  getOwnId: () => string;
  getAllGroups: () => Promise<Array<{ groupId: string }>>;
  getGroupInfo: () => Promise<{ gridInfoMap: Record<string, Record<string, unknown>> }>;
  getAliasList: () => Promise<{ items: Array<{ userId: string; alias: string }> }>;
  getAllFriends: () => Promise<Array<Record<string, unknown>>>;
}

/** Counts one `calls` per directory fetch (getAllGroups is its first Zalo call). */
function createFakeApi(): FakeZaloApi {
  const api: FakeZaloApi = {
    calls: 0,
    failFriends: false,
    getOwnId: () => OWN_ID,
    getAllGroups: () => {
      api.calls += 1;
      return Promise.resolve([{ groupId: 'g-fresh' }]);
    },
    getGroupInfo: () =>
      Promise.resolve({ gridInfoMap: { 'g-fresh': { name: 'Fresh group', totalMember: 3 } } }),
    getAliasList: () => Promise.resolve({ items: [] }),
    getAllFriends: () =>
      api.failFriends
        ? Promise.reject(new Error('429'))
        : Promise.resolve([{ userId: 'u-fresh', displayName: 'Fresh friend' }]),
  };
  return api;
}

function createService(): { service: ZcaService; redis: FakeRedis; api: FakeZaloApi } {
  const redis = new FakeRedis();
  const service = new ZcaService(
    new ConfigService({}),
    undefined,
    undefined,
    undefined,
    undefined,
    redis,
  );
  const api = createFakeApi();
  Reflect.set(service, 'api', api);
  return { service, redis, api };
}

function snapshotAt(fetchedAt: Date, overrides?: Partial<ZcaDirectorySnapshot>): string {
  const snapshot: ZcaDirectorySnapshot = {
    fetchedAt: fetchedAt.toISOString(),
    complete: true,
    groups: [{ id: 'g-cached', name: 'Cached group', type: 'group' }],
    friends: [{ id: 'u-cached', name: 'Cached friend', type: 'user' }],
    ...overrides,
  };
  return JSON.stringify(snapshot);
}

async function flushBackgroundWork(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

void test('parseZcaDirectorySnapshot rejects malformed data and drops invalid entries', () => {
  assert.equal(parseZcaDirectorySnapshot(null), null);
  assert.equal(parseZcaDirectorySnapshot('{not json'), null);
  assert.equal(parseZcaDirectorySnapshot(JSON.stringify({ fetchedAt: 'x', groups: [] })), null);
  assert.equal(
    parseZcaDirectorySnapshot(JSON.stringify({ fetchedAt: new Date().toISOString(), groups: [] })),
    null,
  );

  const parsed = parseZcaDirectorySnapshot(
    JSON.stringify({
      fetchedAt: '2026-10-01T00:00:00.000Z',
      complete: true,
      groups: [{ id: 'g1', name: 'G', type: 'group', totalMembers: 4 }, { id: 'bad' }],
      friends: [{ id: 'u1', name: 'U', type: 'user', alias: 'Alias', extra: 1 }],
    }),
  );
  assert.deepEqual(parsed, {
    fetchedAt: '2026-10-01T00:00:00.000Z',
    complete: true,
    groups: [{ id: 'g1', name: 'G', type: 'group', totalMembers: 4 }],
    friends: [{ id: 'u1', name: 'U', type: 'user', alias: 'Alias' }],
  });
});

void test('isZcaDirectoryStale treats week-old or partial snapshots as stale', () => {
  const now = Date.now();
  const fresh = parseZcaDirectorySnapshot(snapshotAt(new Date(now - 1000)));
  const old = parseZcaDirectorySnapshot(snapshotAt(new Date(now - ZCA_DIRECTORY_SOFT_TTL_MS)));
  const partial = parseZcaDirectorySnapshot(snapshotAt(new Date(now - 1000), { complete: false }));
  assert.ok(fresh && old && partial);
  assert.equal(isZcaDirectoryStale(fresh, now), false);
  assert.equal(isZcaDirectoryStale(old, now), true);
  assert.equal(isZcaDirectoryStale(partial, now), true);
});

void test('mergeZcaDirectory keeps the previous entries of a failed section', () => {
  const previous = parseZcaDirectorySnapshot(snapshotAt(new Date('2026-10-01T00:00:00Z')));
  const fetchedAt = new Date('2026-10-20T00:00:00Z');
  const freshGroups = {
    complete: true,
    entries: [{ id: 'g-new', name: 'New', type: 'group' as const }],
  };

  const merged = mergeZcaDirectory(
    freshGroups,
    { complete: false, entries: [] },
    previous,
    fetchedAt,
  );
  assert.deepEqual(merged, {
    fetchedAt: fetchedAt.toISOString(),
    complete: false,
    groups: freshGroups.entries,
    friends: previous?.friends,
  });

  assert.equal(
    mergeZcaDirectory(
      { complete: false, entries: [] },
      { complete: false, entries: [] },
      previous,
      fetchedAt,
    ),
    null,
  );
});

void test('getAvailableThreads serves a fresh Redis snapshot without calling Zalo', async () => {
  const { service, redis, api } = createService();
  redis.store.set(zcaDirectoryRedisKey(OWN_ID), snapshotAt(new Date()));

  const threads = await service.getAvailableThreads();
  await service.getAvailableThreads();

  assert.equal(api.calls, 0);
  assert.deepEqual(
    threads.map((t) => t.id),
    ['g-cached', 'u-cached'],
  );
  assert.equal(threads[0]?.isListened, false);
  assert.ok(service.getDirectoryFetchedAt());
});

void test('getAvailableThreads fetches once when nothing is cached and stores it in Redis', async () => {
  const { service, redis, api } = createService();

  const threads = await service.getAvailableThreads();
  await service.getAvailableThreads();

  assert.equal(api.calls, 1);
  assert.deepEqual(
    threads.map((t) => t.id),
    ['g-fresh', 'u-fresh'],
  );
  const stored = parseZcaDirectorySnapshot(redis.store.get(zcaDirectoryRedisKey(OWN_ID)) ?? null);
  assert.equal(stored?.complete, true);
  assert.equal(stored?.groups[0]?.name, 'Fresh group');
  assert.equal(redis.ttls.get(zcaDirectoryRedisKey(OWN_ID)), ZCA_DIRECTORY_HARD_TTL_SECONDS);
});

void test('getAvailableThreads returns a stale snapshot at once and refreshes it in the background', async () => {
  const { service, redis, api } = createService();
  const weekAgo = new Date(Date.now() - ZCA_DIRECTORY_SOFT_TTL_MS - 1000);
  redis.store.set(zcaDirectoryRedisKey(OWN_ID), snapshotAt(weekAgo));

  const threads = await service.getAvailableThreads();
  assert.deepEqual(
    threads.map((t) => t.id),
    ['g-cached', 'u-cached'],
  );

  await flushBackgroundWork();
  await service.getAvailableThreads();
  assert.equal(api.calls, 1);
  const refreshed = await service.getAvailableThreads();
  assert.deepEqual(
    refreshed.map((t) => t.id),
    ['g-fresh', 'u-fresh'],
  );
});

void test('forced refreshes inside the cooldown reuse the last fetch', async () => {
  const { service, api } = createService();

  await service.getAvailableThreads(true);
  await service.getAvailableThreads(true);

  assert.equal(api.calls, 1);
});

void test('a forced refresh whose friends call fails keeps the cached friends', async () => {
  const { service, redis, api } = createService();
  redis.store.set(zcaDirectoryRedisKey(OWN_ID), snapshotAt(new Date()));
  api.failFriends = true;

  const threads = await service.getAvailableThreads(true);

  assert.equal(api.calls, 1);
  assert.deepEqual(
    threads.map((t) => t.id),
    ['g-fresh', 'u-cached'],
  );
  const stored = parseZcaDirectorySnapshot(redis.store.get(zcaDirectoryRedisKey(OWN_ID)) ?? null);
  assert.equal(stored?.complete, false);
});

void test('listened ids Zalo did not return are flagged missingFromZalo and are not in the directory', async () => {
  const { service, redis } = createService();
  redis.store.set(zcaDirectoryRedisKey(OWN_ID), snapshotAt(new Date()));
  Reflect.set(service, 'listenedThreadIds', new Set(['g-cached', 'orphan-1']));

  const threads = await service.getAvailableThreads();

  assert.equal(threads.find((t) => t.id === 'g-cached')?.missingFromZalo, undefined);
  assert.equal(threads.find((t) => t.id === 'orphan-1')?.missingFromZalo, true);
  assert.equal(service.isInDirectory('g-cached'), true);
  assert.equal(service.isInDirectory('u-cached'), true);
  assert.equal(service.isInDirectory('orphan-1'), false);

  service.forgetThread('orphan-1');
  const afterForget = await service.getAvailableThreads();
  assert.equal(
    afterForget.some((t) => t.id === 'orphan-1'),
    false,
  );
});
