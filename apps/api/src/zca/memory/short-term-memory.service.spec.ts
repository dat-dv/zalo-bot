import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORT_TERM_MEMORY_MAX_ENTRIES,
  ShortTermMemoryService,
  shortTermTtlSeconds,
  type ShortTermMemoryRedis,
} from './short-term-memory.service';

const NOW = Date.now();
const HOUR_MS = 3600 * 1000;
/** Messages are timestamped relative to now, because reads drop those older than the chat's days. */
const minutesAgo = (minutes: number) => NOW - minutes * 60 * 1000;

/** In-memory Redis list fake that records the TTL it was given. */
function createRedisFake(): { redis: ShortTermMemoryRedis; ttls: Map<string, number> } {
  const lists = new Map<string, string[]>();
  const ttls = new Map<string, number>();
  const redis: ShortTermMemoryRedis = {
    isReady: true,
    lrange: (key) => Promise.resolve([...(lists.get(key) ?? [])]),
    rpush: (key, ...values) => {
      lists.set(key, [...(lists.get(key) ?? []), ...values]);
      return Promise.resolve(true);
    },
    ltrim: (key, start) => {
      lists.set(key, (lists.get(key) ?? []).slice(start));
      return Promise.resolve(true);
    },
    expire: (key, seconds) => {
      ttls.set(key, seconds);
      return Promise.resolve(true);
    },
    del: (key) => {
      lists.delete(key);
      return Promise.resolve(true);
    },
  };
  return { redis, ttls };
}

function message(msgId: string, text: string, ts: number, extra: Record<string, unknown> = {}) {
  return { msgId, content: text, ts, uidFrom: 'u1', dName: 'Nam', ...extra };
}

for (const [label, makeService] of [
  ['Redis', () => new ShortTermMemoryService(createRedisFake().redis)],
  ['local fallback', () => new ShortTermMemoryService()],
] as const) {
  void test(`ShortTermMemoryService (${label}) returns the latest messages oldest first`, async () => {
    const service = makeService();
    await service.record('t1', message('m1', 'ăn trưa 45k', minutesAgo(30)), 1);
    await service.record('t1', message('m2', 'còn cà phê nữa', minutesAgo(20)), 1);
    await service.record('t1', message('m3', 'ghi giúp cái đó', minutesAgo(10)), 1);
    await service.record('t2', message('x1', 'kênh khác', minutesAgo(25)), 1);

    const lines = await service.getRecent('t1', { limit: 2, maxAgeDays: 1, excludeMsgId: 'm3' });
    assert.deepEqual(
      lines.map((line) => line.text),
      ['ăn trưa 45k', 'còn cà phê nữa'],
    );
    assert.equal(lines[0].senderName, 'Nam');
    assert.deepEqual(await service.getRecent('t1', { limit: 0, maxAgeDays: 1 }), []);
  });

  void test(`ShortTermMemoryService (${label}) forgets recalled messages`, async () => {
    const service = makeService();
    await service.record('t1', message('m1', 'giữ lại', minutesAgo(30)), 1);
    await service.record('t1', message('m2', 'thu hồi theo id', minutesAgo(20)), 1);
    await service.record(
      't1',
      message('m3', 'thu hồi theo client id', minutesAgo(10), { cliMsgId: 'c3' }),
      1,
    );

    await service.markRecalled('t1', 'm2');
    // Same client id from another sender is a different message.
    await service.markRecalled('t1', 'other', { cliMsgId: 'c3', senderUid: 'u2' });
    assert.equal((await service.getRecent('t1', { limit: 10, maxAgeDays: 1 })).length, 2);

    await service.markRecalled('t1', 'other', { cliMsgId: 'c3', senderUid: 'u1' });
    assert.deepEqual(
      (await service.getRecent('t1', { limit: 10, maxAgeDays: 1 })).map((line) => line.text),
      ['giữ lại'],
    );
  });

  void test(`ShortTermMemoryService (${label}) gives a photo the text read from it`, async () => {
    const service = makeService();
    const photo = message('p1', '', minutesAgo(30), {
      msgType: 'chat.photo',
      content: { title: 'menu trưa', href: 'https://cdn/x.jpg' },
    });
    await service.record('t1', photo, 1);
    await service.record('t1', message('m2', 'ăn gì đây', minutesAgo(20)), 1);
    await service.recordImageText('t1', photo, '[Ảnh] menu trưa — chữ trong ảnh: CƠM GÀ 45.000', 1);

    const lines = await service.getRecent('t1', { limit: 10, maxAgeDays: 1 });
    assert.deepEqual(
      lines.map((line) => line.text),
      ['[Ảnh] menu trưa — chữ trong ảnh: CƠM GÀ 45.000', 'ăn gì đây'],
    );
  });

  void test(`ShortTermMemoryService (${label}) does not bring back a photo recalled while it was read`, async () => {
    const service = makeService();
    const photo = message('p1', '', minutesAgo(30), {
      msgType: 'chat.photo',
      content: { href: 'https://cdn/x.jpg' },
    });
    await service.record('t1', photo, 1);
    await service.markRecalled('t1', 'p1');
    await service.recordImageText('t1', photo, '[Ảnh] — chữ trong ảnh: CCCD 0790', 1);

    assert.deepEqual(await service.getRecent('t1', { limit: 10, maxAgeDays: 1 }), []);
  });

  void test(`ShortTermMemoryService (${label}) merges a bot reply with its self-listen echo`, async () => {
    const service = makeService();
    await service.record('t1', message('b1', 'Đã ghi 45k', minutesAgo(30)), 1);
    await service.recordBotReply('t1', 'b1', 'Đã ghi 45k', 1);

    const lines = await service.getRecent('t1', { limit: 10, maxAgeDays: 1 });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].isBot, true);
  });
}

void test("ShortTermMemoryService caps the Redis list and expires it after the chat's days", async () => {
  const { redis, ttls } = createRedisFake();
  const service = new ShortTermMemoryService(redis);
  for (let i = 0; i < SHORT_TERM_MEMORY_MAX_ENTRIES + 5; i += 1) {
    await service.record('t1', message(`m${i}`, `tin ${i}`, minutesAgo(100 - i)), 3);
  }

  const lines = await service.getRecent('t1', {
    limit: SHORT_TERM_MEMORY_MAX_ENTRIES + 5,
    maxAgeDays: 1,
  });
  assert.equal(lines.length, SHORT_TERM_MEMORY_MAX_ENTRIES);
  assert.equal(lines[0].text, 'tin 5');
  assert.equal(ttls.get('zca:short_memory:t1'), shortTermTtlSeconds(3));
});

void test('ShortTermMemoryService skips messages without an id or text', async () => {
  const service = new ShortTermMemoryService();
  await service.record('t1', { content: 'không có id', ts: NOW }, 1);
  await service.record('t1', message('m1', '   ', minutesAgo(30)), 1);
  assert.deepEqual(await service.getRecent('t1', { limit: 10, maxAgeDays: 1 }), []);
});

void test("ShortTermMemoryService only hands out messages sent within the chat's days", async () => {
  // The chat never goes quiet, so the list never expires; age still counts per message.
  const service = new ShortTermMemoryService(createRedisFake().redis);
  await service.record('t1', message('old', 'tuần trước', NOW - 5 * 24 * HOUR_MS), 7);
  await service.record('t1', message('mid', 'hôm kia', NOW - 40 * HOUR_MS), 7);
  await service.record('t1', message('new', 'vừa nói', minutesAgo(5)), 7);

  const texts = async (maxAgeDays: number) =>
    (await service.getRecent('t1', { limit: 10, maxAgeDays })).map((line) => line.text);
  assert.deepEqual(await texts(1), ['vừa nói']);
  assert.deepEqual(await texts(2), ['hôm kia', 'vừa nói']);
  assert.deepEqual(await texts(7), ['tuần trước', 'hôm kia', 'vừa nói']);
});
