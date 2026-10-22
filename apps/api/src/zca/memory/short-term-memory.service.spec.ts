import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORT_TERM_MEMORY_MAX_ENTRIES,
  SHORT_TERM_MEMORY_TTL_SECONDS,
  ShortTermMemoryService,
  type ShortTermMemoryRedis,
} from './short-term-memory.service';

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
    await service.record('t1', message('m1', 'ăn trưa 45k', 1000));
    await service.record('t1', message('m2', 'còn cà phê nữa', 2000));
    await service.record('t1', message('m3', 'ghi giúp cái đó', 3000));
    await service.record('t2', message('x1', 'kênh khác', 1500));

    const lines = await service.getRecent('t1', 2, 'm3');
    assert.deepEqual(
      lines.map((line) => line.text),
      ['ăn trưa 45k', 'còn cà phê nữa'],
    );
    assert.equal(lines[0].senderName, 'Nam');
    assert.deepEqual(await service.getRecent('t1', 0), []);
  });

  void test(`ShortTermMemoryService (${label}) forgets recalled messages`, async () => {
    const service = makeService();
    await service.record('t1', message('m1', 'giữ lại', 1000));
    await service.record('t1', message('m2', 'thu hồi theo id', 2000));
    await service.record('t1', message('m3', 'thu hồi theo client id', 3000, { cliMsgId: 'c3' }));

    await service.markRecalled('t1', 'm2');
    // Same client id from another sender is a different message.
    await service.markRecalled('t1', 'other', { cliMsgId: 'c3', senderUid: 'u2' });
    assert.equal((await service.getRecent('t1', 10)).length, 2);

    await service.markRecalled('t1', 'other', { cliMsgId: 'c3', senderUid: 'u1' });
    assert.deepEqual(
      (await service.getRecent('t1', 10)).map((line) => line.text),
      ['giữ lại'],
    );
  });

  void test(`ShortTermMemoryService (${label}) merges a bot reply with its self-listen echo`, async () => {
    const service = makeService();
    await service.record('t1', message('b1', 'Đã ghi 45k', 1000));
    await service.recordBotReply('t1', 'b1', 'Đã ghi 45k');

    const lines = await service.getRecent('t1', 10);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].isBot, true);
  });
}

void test('ShortTermMemoryService caps the Redis list and sets the 24 hour expiry', async () => {
  const { redis, ttls } = createRedisFake();
  const service = new ShortTermMemoryService(redis);
  for (let i = 0; i < SHORT_TERM_MEMORY_MAX_ENTRIES + 5; i += 1) {
    await service.record('t1', message(`m${i}`, `tin ${i}`, 1000 + i));
  }

  const lines = await service.getRecent('t1', SHORT_TERM_MEMORY_MAX_ENTRIES + 5);
  assert.equal(lines.length, SHORT_TERM_MEMORY_MAX_ENTRIES);
  assert.equal(lines[0].text, 'tin 5');
  assert.equal(ttls.get('zca:short_memory:t1'), SHORT_TERM_MEMORY_TTL_SECONDS);
});

void test('ShortTermMemoryService skips messages without an id or text', async () => {
  const service = new ShortTermMemoryService();
  await service.record('t1', { content: 'không có id', ts: 1000 });
  await service.record('t1', message('m1', '   ', 1000));
  assert.deepEqual(await service.getRecent('t1', 10), []);
});
