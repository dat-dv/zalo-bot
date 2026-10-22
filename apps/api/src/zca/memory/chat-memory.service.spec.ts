import test from 'node:test';
import assert from 'node:assert/strict';
import type { Repository } from 'typeorm';
import type { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { ChatMemoryService, selectMemoryLines, type MemoryLineRow } from './chat-memory.service';

interface RecordedCall {
  method: string;
  args: unknown[];
}

/** Chainable query-builder stub that records every call and resolves `execute`. */
function createRepositoryStub(queryResults: unknown[][] = []): {
  repository: Repository<ZcaMessageEntity>;
  calls: RecordedCall[];
  rawQueries: Array<{ sql: string; params: unknown[] }>;
} {
  const calls: RecordedCall[] = [];
  const rawQueries: Array<{ sql: string; params: unknown[] }> = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of [
    'insert',
    'into',
    'values',
    'orIgnore',
    'orUpdate',
    'update',
    'set',
    'where',
    'andWhere',
  ]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.execute = () => {
    calls.push({ method: 'execute', args: [] });
    return Promise.resolve({});
  };

  const repository = {
    createQueryBuilder: () => builder,
    query: (sql: string, params: unknown[]) => {
      rawQueries.push({ sql, params });
      return Promise.resolve(queryResults.shift() ?? []);
    },
  } as unknown as Repository<ZcaMessageEntity>;
  return { repository, calls, rawQueries };
}

function createService(queryResults: unknown[][] = []) {
  const stub = createRepositoryStub(queryResults);
  return { service: new ChatMemoryService(stub.repository), ...stub };
}

void test('record inserts with ON CONFLICT DO NOTHING', async () => {
  const { service, calls } = createService();

  await service.record('g-1', 'group', { msgId: '1', content: 'đi Đà Lạt', ts: '1720785780000' });

  const methods = calls.map((call) => call.method);
  assert.deepEqual(methods, ['insert', 'into', 'values', 'orIgnore', 'execute']);
  const [values] = calls[2].args as [Array<{ text: string; channelId: string }>];
  assert.equal(values[0].text, 'đi Đà Lạt');
  assert.equal(values[0].channelId, 'g-1');
});

void test('recordBotReply upserts the bot flag', async () => {
  const { service, calls } = createService();

  await service.recordBotReply('g-1', 'group', '99', 'Đã ghi nhận');

  const upsert = calls.find((call) => call.method === 'orUpdate');
  assert.deepEqual(upsert?.args, [['is_bot'], ['channel_id', 'msg_id']]);
});

void test('markRecalled erases the content of the recalled message only in its channel', async () => {
  const { service, calls } = createService();

  await service.markRecalled('g-1', '7001', '55');

  const set = calls.find((call) => call.method === 'set');
  const values = set?.args[0] as { text: unknown; content: unknown };
  assert.equal(values.text, null);
  assert.equal(values.content, null);
  assert.deepEqual(calls.find((call) => call.method === 'where')?.args, [
    'channel_id = :channelId',
    { channelId: 'g-1' },
  ]);
});

void test('search runs hit then neighbour queries and returns chronological lines', async () => {
  const neighbourRows: MemoryLineRow[] = [
    {
      id: 'b',
      sender_name: 'Nam',
      is_bot: false,
      text: 'vé xe đặt rồi',
      sent_at: '2025-07-12T12:05:00Z',
      hit_rank: 1,
    },
    {
      id: 'a',
      sender_name: 'Đạt',
      is_bot: false,
      text: 'đi Đà Lạt',
      sent_at: '2025-07-12T12:00:00Z',
      hit_rank: 1,
    },
  ];
  const { service, rawQueries } = createService([[{ id: 'a' }], neighbourRows]);

  const lines = await service.search('g-1', { keywords: 'Đà Lạt', limit: 5, timeZone: 'UTC' });

  assert.equal(rawQueries.length, 2);
  assert.deepEqual(rawQueries[1].params, ['g-1', ['a']]);
  assert.deepEqual(
    lines.map((line) => line.text),
    ['đi Đà Lạt', 'vé xe đặt rồi'],
  );
});

void test('search skips the neighbour query when nothing matches', async () => {
  const { service, rawQueries } = createService([[]]);

  const lines = await service.search('g-1', { keywords: 'Đà Lạt', limit: 5, timeZone: 'UTC' });

  assert.deepEqual(lines, []);
  assert.equal(rawQueries.length, 1);
});

void test('selectMemoryLines dedupes, keeps best-ranked hits first under the cap', () => {
  const rows: MemoryLineRow[] = [
    { id: '1', sender_name: 'A', is_bot: false, text: 'best', sent_at: '2025-03-01T00:00:00Z' },
    { id: '1', sender_name: 'A', is_bot: false, text: 'best', sent_at: '2025-03-01T00:00:00Z' },
    { id: '2', sender_name: 'B', is_bot: false, text: 'early', sent_at: '2025-01-01T00:00:00Z' },
    { id: '3', sender_name: 'C', is_bot: false, text: 'dropped', sent_at: '2024-01-01T00:00:00Z' },
  ];

  const lines = selectMemoryLines(rows, 2);

  assert.deepEqual(
    lines.map((line) => line.text),
    ['early', 'best'],
  );
});
