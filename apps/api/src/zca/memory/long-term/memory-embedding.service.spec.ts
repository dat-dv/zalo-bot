import assert from 'node:assert/strict';
import test from 'node:test';
import type { Repository } from 'typeorm';
import type { ThreadBotConfig } from '@zalobot/contracts';
import type { ZcaMessageEntity } from '../../../database/entities/zca-message.entity';
import type { ThreadConfigService } from '../../thread-config.service';
import type { ChatMemoryService } from '../chat-memory.service';
import { EMBEDDING_DIMENSIONS, readVectors, type TextEmbedder } from './local-embedder';
import { syncResultText } from './memory-embedding.processor';
import {
  EMBED_ROUND_SIZE,
  MemoryEmbeddingService,
  readContextLines,
} from './memory-embedding.service';

const MODEL = 'test-model';

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === seed ? 1 : 0));
}

function createEmbedder(options: { fail?: boolean } = {}) {
  const calls: string[][] = [];
  const embedder: TextEmbedder = {
    model: MODEL,
    state: () => (options.fail ? 'failed' : 'ready'),
    embed: (texts) => {
      calls.push([...texts]);
      return Promise.resolve(options.fail ? null : texts.map((_, i) => vector(i)));
    },
  };
  return { embedder, calls };
}

function createService(
  queryResults: unknown[][],
  options: { fail?: boolean; configs?: Array<Partial<ThreadBotConfig>> } = {},
) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const repository = {
    query: (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return Promise.resolve(queryResults.shift() ?? []);
    },
  } as unknown as Repository<ZcaMessageEntity>;
  const configs = options.configs ?? [];
  const threadConfigService = {
    getAllConfigs: () => configs,
    findStoredConfig: (id: string) =>
      Promise.resolve(configs.find((config) => config.threadId === id) ?? null),
  } as unknown as ThreadConfigService;
  let purged = 0;
  const chatMemory = {
    purgeExpired: () => {
      purged += 1;
      return Promise.resolve(0);
    },
  } as unknown as ChatMemoryService;
  const { embedder, calls } = createEmbedder(options);
  const service = new MemoryEmbeddingService(threadConfigService, chatMemory, repository, embedder);
  return { service, queries, calls, purgedCount: () => purged };
}

const memoryOn = (threadId: string): Partial<ThreadBotConfig> => ({
  threadId,
  isListened: true,
  chatMemory: { enabled: true, readImageText: true, learnPeople: false },
});

void test('embedPending embeds pending messages with their context and stores them', async () => {
  const pending = [
    {
      id: 'a',
      channel_id: 'g-1',
      sender_name: 'Nam',
      text: 'ok chốt',
      context: [{ sender_name: 'Hằng', text: 'lẩu Thái?' }],
    },
    { id: 'b', channel_id: 'g-1', sender_name: 'Hằng', text: 'đi 7h', context: [] },
  ];
  const { service, queries, calls } = createService([pending, []]);

  assert.equal(await service.embedPending(['g-1']), 2);
  assert.deepEqual(calls, [['Nam: ok chốt\nHằng: lẩu Thái?', 'Hằng: đi 7h']]);
  assert.match(queries[0].sql, /NOT EXISTS \(SELECT 1 FROM zca_message_embeddings e/);
  assert.deepEqual(queries[0].params.slice(0, 2), [['g-1'], MODEL]);
  assert.match(queries[1].sql, /INSERT INTO zca_message_embeddings/);
  assert.match(queries[1].sql, /ON CONFLICT \(message_id\) DO UPDATE/);
  assert.deepEqual(queries[1].params[0], ['a', 'b']);
  const literals = queries[1].params[2] as string[];
  assert.equal(literals[0].startsWith('[1,0,0'), true);
  assert.equal(queries.length, 2, 'a short round ends the run');
});

void test('embedPending keeps reading full rounds and stops at the limit', async () => {
  const round = Array.from({ length: EMBED_ROUND_SIZE }, (_, i): Record<string, unknown> => ({
    id: `m${i}`,
    channel_id: 'g-1',
    sender_name: null,
    text: `tin ${i}`,
    context: null,
  }));
  const { service } = createService([round, [], round, []]);
  assert.equal(await service.embedPending(['g-1'], EMBED_ROUND_SIZE * 2), EMBED_ROUND_SIZE * 2);
});

void test('embedPending resolves null when the model is unavailable and writes nothing', async () => {
  const { service, queries } = createService(
    [[{ id: 'a', channel_id: 'g-1', sender_name: null, text: 'x', context: [] }]],
    { fail: true },
  );
  assert.equal(await service.embedPending(['g-1']), null);
  assert.equal(queries.length, 1);
});

void test('runChannel skips chats without long-term memory; runNightly embeds every memory chat', async () => {
  const off = createService([], { configs: [{ threadId: 'g-2', isListened: true }] });
  assert.equal(await off.service.runChannel('g-2'), null);

  const on = createService([[]], {
    configs: [memoryOn('g-1'), { threadId: 'g-2', isListened: true }, memoryOn('g-3')],
  });
  assert.deepEqual(on.service.memoryChannels(), ['g-1', 'g-3']);
  await on.service.runNightly();
  assert.equal(on.purgedCount(), 1);
  assert.deepEqual(on.queries[0].params[0], ['g-1', 'g-3']);
});

void test('status reports counts of the current model and the embedder state', async () => {
  const { service, queries } = createService([
    [{ embedded: '12', pending: '3', last: new Date('2026-11-17T01:00:00Z') }],
  ]);
  assert.deepEqual(await service.status('g-1'), {
    embedder: 'ready',
    embeddedMessages: 12,
    pendingMessages: 3,
    lastEmbeddedAt: '2026-11-17T01:00:00.000Z',
  });
  assert.deepEqual(queries[0].params, ['g-1', MODEL]);
});

void test('readContextLines and readVectors reject malformed rows', () => {
  assert.deepEqual(readContextLines([{ sender_name: 'A', text: 'x' }, { text: 3 }, null, 'y']), [
    { senderName: 'A', text: 'x' },
  ]);
  assert.deepEqual(readContextLines(null), []);
  assert.equal(readVectors([vector(0)], 1)?.length, 1);
  assert.equal(readVectors([[1, 2]], 1), null);
  assert.equal(readVectors([vector(0)], 2), null);
});

void test('syncResultText tells what /sync did', () => {
  assert.match(syncResultText(null), /chưa bật Nhớ lâu dài/);
  assert.equal(
    syncResultText({ embedded: 4, unavailable: false }),
    '🧠 Đã cập nhật trí nhớ: 4 tin mới.',
  );
  assert.match(syncResultText({ embedded: 0, unavailable: false }), /không có tin mới/);
  assert.match(syncResultText({ embedded: 0, unavailable: true }), /theo từ khoá/);
});
