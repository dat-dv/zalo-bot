import test from 'node:test';
import assert from 'node:assert/strict';
import type { Repository } from 'typeorm';
import type { ZcaMessageEntity } from '../../database/entities/zca-message.entity';
import { ChatMemoryService, selectMemoryLines, type MemoryLineRow } from './chat-memory.service';
import { EMBEDDING_DIMENSIONS, type TextEmbedder } from './long-term/local-embedder';

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
    'returning',
    'delete',
    'from',
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

interface InsertedRow {
  text: string | null;
  channelId: string;
  memoryKind: string;
  senderName: string | null;
  isBot: boolean;
}

function insertedRows(calls: RecordedCall[]): InsertedRow[] {
  const values = calls.find((call) => call.method === 'values');
  return (values?.args[0] as InsertedRow[] | InsertedRow | undefined) instanceof Array
    ? (values?.args[0] as InsertedRow[])
    : [values?.args[0] as InsertedRow];
}

void test('record inserts one row with ON CONFLICT DO NOTHING', async () => {
  const { service, calls } = createService();

  await service.record('g-1', 'group', { msgId: '1', content: 'đi Đà Lạt', ts: '1720785780000' });

  const methods = calls.map((call) => call.method);
  assert.deepEqual(methods, ['insert', 'into', 'values', 'orIgnore', 'execute']);
  const [row] = insertedRows(calls);
  assert.equal(row.text, 'đi Đà Lạt');
  assert.equal(row.channelId, 'g-1');
  assert.equal(row.memoryKind, 'chat');
});

void test('recordBotReply upserts the bot flag and the kind it was sent as', async () => {
  const { service, calls } = createService();

  await service.recordBotReply('g-1', 'group', '99', 'Thêm việc [302]?', 'card');

  const upsert = calls.find((call) => call.method === 'orUpdate');
  assert.deepEqual(upsert?.args, [
    ['is_bot', 'memory_kind', 'text', 'content'],
    ['channel_id', 'msg_id'],
  ]);
  const [row] = insertedRows(calls);
  assert.equal(row.memoryKind, 'card');
  assert.equal(row.isBot, true);
});

void test('recordBotReply never keeps the text of a secret message', async () => {
  const { service, calls } = createService();

  await service.recordBotReply(
    'g-1',
    'group',
    '99',
    'Dashboard: https://x/api/access?token=abc',
    'secret',
  );

  const [row] = insertedRows(calls);
  assert.equal(row.text, '[Link đăng nhập dashboard]');
});

void test('recordAction stores a confirmed action from the requester, falling back to their last name', async () => {
  const { service, calls, rawQueries } = createService([[{ sender_name: 'Văn Đạt' }]]);

  await service.recordAction('g-1', 'group', {
    actionId: 'action:358:1',
    requesterUid: 'u-1',
    requesterName: null,
    text: '(đã duyệt) Chi 5.000đ',
  });

  assert.match(rawQueries[0].sql, /sender_uid = \$2/);
  const [row] = insertedRows(calls);
  assert.equal(row.memoryKind, 'action');
  assert.equal(row.senderName, 'Văn Đạt');
  assert.equal(row.isBot, false);
});

void test('purgeExpired deletes only rows past their short-term expiry', async () => {
  const { service, calls } = createService();

  await service.purgeExpired(new Date('2026-10-25T00:00:00Z'));

  assert.deepEqual(
    calls
      .filter((call) => call.method === 'where' || call.method === 'andWhere')
      .map((call) => call.args[0]),
    ['expires_at IS NOT NULL', 'expires_at < :now'],
  );
});

void test('markRecalled erases the content of the recalled message only in its channel', async () => {
  const { service, calls } = createService();

  await service.markRecalled('g-1', '7001', { cliMsgId: '55', senderUid: 'u-9' });

  const set = calls.find((call) => call.method === 'set');
  const values = set?.args[0] as { text: unknown; content: unknown };
  assert.equal(values.text, null);
  assert.equal(values.content, null);
  assert.deepEqual(calls.find((call) => call.method === 'where')?.args, [
    'channel_id = :channelId',
    { channelId: 'g-1' },
  ]);
});

void test('attachImageText updates only the member photo row that is not recalled', async () => {
  const { service, calls } = createService();

  await service.attachImageText('g-1', '7001', '[Ảnh] — chữ trong ảnh: CƠM GÀ 45.000');

  assert.deepEqual(calls.find((call) => call.method === 'set')?.args, [
    { text: '[Ảnh] — chữ trong ảnh: CƠM GÀ 45.000' },
  ]);
  assert.deepEqual(
    calls.filter((call) => call.method === 'andWhere').map((call) => call.args[0]),
    ['msg_id = :msgId', 'recalled_at IS NULL', 'NOT is_bot'],
  );
  assert.ok(calls.some((call) => call.method === 'execute'));

  const skipped = createService();
  await skipped.service.attachImageText('g-1', '7001', '');
  assert.equal(skipped.calls.length, 0);
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

void test('markRecalled matches the client id only together with its sender', async () => {
  const withClient = createService();
  await withClient.service.markRecalled('g-1', '7001', { cliMsgId: '55', senderUid: 'u-9' });
  assert.deepEqual(withClient.calls.find((call) => call.method === 'andWhere')?.args, [
    '(msg_id = :msgId OR (cli_msg_id = :cliMsgId AND sender_uid = :senderUid))',
    { msgId: '7001', cliMsgId: '55', senderUid: 'u-9' },
  ]);

  const byIdOnly = createService();
  await byIdOnly.service.markRecalled('g-1', '7001');
  assert.equal(
    (byIdOnly.calls.find((call) => call.method === 'andWhere')?.args ?? [])[0],
    'msg_id = :msgId',
  );
});

function fakeEmbedder(): TextEmbedder {
  return {
    model: 'minilm',
    state: () => 'ready',
    embed: (texts) =>
      Promise.resolve(texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1))),
  };
}

void test('search merges keyword and meaning hits before reading neighbours', async () => {
  const stub = createRepositoryStub([
    [{ id: '11111111-1111-1111-1111-111111111111' }],
    [
      { id: '22222222-2222-2222-2222-222222222222' },
      { id: '11111111-1111-1111-1111-111111111111' },
    ],
    [],
  ]);
  const service = new ChatMemoryService(stub.repository, undefined, fakeEmbedder());
  await service.search('g-1', {
    keywords: 'lẩu',
    question: 'hôm trước ăn gì',
    limit: 5,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(stub.rawQueries.length, 3);
  assert.match(stub.rawQueries[0].sql, /search_vector @@ q\.query/);
  assert.match(stub.rawQueries[1].sql, /zca_message_embeddings e JOIN zca_messages m/);
  assert.deepEqual(stub.rawQueries[2].params[1], [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
  ]);
});

void test('search without an embedder uses the keyword search only', async () => {
  const { service, rawQueries } = createService([[]]);
  await service.search('g-1', { keywords: 'lẩu', question: 'ăn gì', limit: 5, timeZone: 'UTC' });
  assert.equal(rawQueries.length, 1);
});

const SINCE_ISO = '2026-11-16T10:00:00.000Z';
const hasSince = (params: unknown[]) =>
  params.some((param) => param instanceof Date && param.toISOString() === SINCE_ISO);

void test('recallRecent merges phrase and meaning hits of the last 24 hours, then reads neighbours', async () => {
  const now = new Date('2026-11-17T10:00:00Z');
  const stub = createRepositoryStub([
    // Phrase search (issued first: the meaning search waits for the embedding).
    [{ id: '11111111-1111-1111-1111-111111111111' }],
    // Meaning search.
    [{ id: '22222222-2222-2222-2222-222222222222' }],
    [
      {
        id: '11111111-1111-1111-1111-111111111111',
        sender_name: 'Văn Đạt',
        is_bot: false,
        text: 'cái camera cũ còn thẻ nhớ k em',
        sent_at: '2026-11-17T08:57:00Z',
        hit_rank: 1,
      },
    ],
  ]);
  const service = new ChatMemoryService(stub.repository, undefined, fakeEmbedder());
  const lines = await service.recallRecent('g-1', {
    question: 'ở quê có thẻ nhớ k',
    excludeMsgId: 'm-q',
    timeZone: 'Asia/Ho_Chi_Minh',
    now,
  });
  assert.equal(stub.rawQueries.length, 3);
  const [phrase, meaning, neighbours] = stub.rawQueries;
  assert.match(phrase.sql, /phraseto_tsquery/);
  assert.ok(phrase.params.includes('thẻ nhớ'));
  assert.ok(phrase.params.includes('m-q'));
  assert.ok(hasSince(phrase.params));
  assert.match(meaning.sql, /zca_message_embeddings e JOIN zca_messages m/);
  assert.match(meaning.sql, /< 0\.45/);
  assert.ok(meaning.params.includes('m-q'));
  assert.ok(hasSince(meaning.params));
  assert.deepEqual(neighbours.params[1], [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
  ]);
  assert.deepEqual(
    lines.map((line) => line.text),
    ['cái camera cũ còn thẻ nhớ k em'],
  );
});

void test('recallRecent still finds phrases without an embedding model', async () => {
  const stub = createRepositoryStub([[{ id: '11111111-1111-1111-1111-111111111111' }], []]);
  const service = new ChatMemoryService(stub.repository);
  await service.recallRecent('g-1', { question: 'ở quê có thẻ nhớ k', timeZone: 'UTC' });
  assert.equal(stub.rawQueries.length, 2);
  assert.match(stub.rawQueries[0].sql, /phraseto_tsquery/);
  assert.match(stub.rawQueries[1].sql, /unnest/);
});

void test('recallRecent keeps the meaning hits when the phrase search fails', async () => {
  const neighbourIds: unknown[] = [];
  const repository = {
    query: (sql: string, params: unknown[]) => {
      if (sql.includes('phraseto_tsquery')) return Promise.reject(new Error('bad tsquery'));
      if (sql.includes('unnest')) {
        neighbourIds.push(params[1]);
        return Promise.resolve([]);
      }
      return Promise.resolve([{ id: '22222222-2222-2222-2222-222222222222' }]);
    },
  } as unknown as Repository<ZcaMessageEntity>;
  const service = new ChatMemoryService(repository, undefined, fakeEmbedder());
  await service.recallRecent('g-1', { question: 'ở quê có thẻ nhớ k', timeZone: 'UTC' });
  assert.deepEqual(neighbourIds, [['22222222-2222-2222-2222-222222222222']]);
});

void test('recallRecent returns nothing for short messages, without a model or on errors', async () => {
  const short = createRepositoryStub();
  const shortService = new ChatMemoryService(short.repository, undefined, fakeEmbedder());
  assert.deepEqual(
    await shortService.recallRecent('g-1', { question: 'hello', timeZone: 'UTC' }),
    [],
  );
  assert.equal(short.rawQueries.length, 0);

  // No phrase ("ăn" and "ngon" are not adjacent) and no model: nothing is queried.
  const { service: noModel, rawQueries } = createService();
  assert.deepEqual(
    await noModel.recallRecent('g-1', { question: 'hôm nay ăn gì ngon', timeZone: 'UTC' }),
    [],
  );
  assert.equal(rawQueries.length, 0);

  const failingRepository = {
    query: (sql: string) =>
      sql.includes('unnest')
        ? Promise.reject(new Error('db down'))
        : Promise.resolve([{ id: '11111111-1111-1111-1111-111111111111' }]),
  } as unknown as Repository<ZcaMessageEntity>;
  const failingService = new ChatMemoryService(failingRepository, undefined, fakeEmbedder());
  assert.deepEqual(
    await failingService.recallRecent('g-1', { question: 'ở quê có thẻ nhớ k', timeZone: 'UTC' }),
    [],
  );
});

void test('a stored message notifies the change listeners of its chat', async () => {
  const { service } = createService();
  const changed: string[] = [];
  const unsubscribe = service.onChange((channelId) => changed.push(channelId));
  await service.record('g-1', 'group', { msgId: '1', content: 'xin chào', ts: Date.now() });
  unsubscribe();
  await service.record('g-1', 'group', { msgId: '2', content: 'lần nữa', ts: Date.now() });
  assert.deepEqual(changed, ['g-1']);
});

void test('markRecalled drops the embeddings that read the recalled message and notifies', async () => {
  const stub = createRepositoryStub();
  const builder = stub.repository.createQueryBuilder() as unknown as {
    execute: () => Promise<unknown>;
  };
  const sentAt = new Date('2026-11-17T03:00:00Z');
  builder.execute = () => Promise.resolve({ raw: [{ sent_at: sentAt }] });
  const service = new ChatMemoryService(stub.repository);
  const changed: string[] = [];
  service.onChange((channelId) => changed.push(channelId));

  assert.deepEqual(await service.markRecalled('g-1', '7001'), [sentAt]);
  const deletion = stub.rawQueries.find((query) =>
    query.sql.startsWith('DELETE FROM zca_message_embeddings'),
  );
  assert.deepEqual(deletion?.params, ['g-1', sentAt, 600]);
  assert.deepEqual(changed, ['g-1']);
});
