import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadBotConfig } from '@zalobot/contracts';
import type { Repository } from 'typeorm';
import type { ZcaMemoryIngestionEntity } from '../../../database/entities/zca-memory-ingestion.entity';
import type { LlmService } from '../../../llm/llm.service';
import type { ThreadConfigService } from '../../thread-config.service';
import type { ChatMemoryService } from '../chat-memory.service';
import type { LearnedFactSubject, LearnedFactsService } from '../learned-facts.service';
import type { CogneeClient } from './cognee.client';
import { MemoryIngestService } from './memory-ingest.service';

interface Fakes {
  enabled?: boolean;
  days?: string[];
  lines?: Array<{ sentAt: Date; senderName: string | null; text: string }>;
  existing?: Partial<ZcaMemoryIngestionEntity>;
  rememberFails?: boolean;
}

const CONFIG = {
  threadId: 'g-1',
  threadName: 'Gia đình',
  isListened: true,
  chatMemory: { enabled: true, learnPeople: true },
} as unknown as ThreadBotConfig;

function createService(fakes: Fakes = {}) {
  const calls: string[] = [];
  const saved: Array<Partial<ZcaMemoryIngestionEntity>> = [];
  const learned: Array<{ subject: LearnedFactSubject; facts: readonly string[] }> = [];
  const chatMemory = {
    timeZone: () => 'Asia/Ho_Chi_Minh',
    purgeExpired: () => {
      calls.push('purge');
      return Promise.resolve(0);
    },
    daysToIngest: () => Promise.resolve(fakes.days ?? ['2026-10-25']),
    dayLines: () =>
      Promise.resolve(
        fakes.lines ?? [
          { sentAt: new Date('2026-10-25T10:02:00Z'), senderName: 'Đạt', text: 'hi' },
        ],
      ),
    activeMembers: () => Promise.resolve([{ userId: 'u1', name: 'Văn Đạt' }]),
  } as unknown as ChatMemoryService;
  const cognee = {
    isEnabled: () => fakes.enabled ?? true,
    remember: (dataset: string, fileName: string) => {
      calls.push(`remember ${dataset} ${fileName}`);
      return Promise.resolve(fakes.rememberFails ? null : { datasetId: 'ds', dataId: 'd2' });
    },
    forget: (datasetId: string, dataId: string) => {
      calls.push(`forget ${datasetId} ${dataId}`);
      return Promise.resolve(true);
    },
    recallContext: () => Promise.resolve(['Văn Đạt -- is -- chồng Diệu Hằng']),
  } as unknown as CogneeClient;
  const facts = {
    deletedFor: () => Promise.resolve([]),
    replaceForSubject: (
      _channelId: string,
      subject: LearnedFactSubject,
      list: readonly string[],
    ) => {
      learned.push({ subject, facts: list });
      return Promise.resolve(list.length);
    },
  } as unknown as LearnedFactsService;
  const llm = {
    generate: () => Promise.resolve({ text: '{"facts": ["Là chồng Diệu Hằng"]}' }),
  } as unknown as LlmService;
  const repository = {
    findOne: () => Promise.resolve(fakes.existing ? { ...fakes.existing } : null),
    create: (row: Partial<ZcaMemoryIngestionEntity>) => ({ ...row }),
    save: (row: Partial<ZcaMemoryIngestionEntity>) => {
      saved.push({ ...row });
      return Promise.resolve(row);
    },
    find: () => Promise.resolve([]),
  } as unknown as Repository<ZcaMemoryIngestionEntity>;
  const threadConfig = {
    getAllConfigs: () => [CONFIG, { ...CONFIG, threadId: 'g-off', chatMemory: { enabled: false } }],
  } as unknown as ThreadConfigService;
  const service = new MemoryIngestService(threadConfig, chatMemory, cognee, facts, llm, repository);
  return { service, calls, saved, learned };
}

void test('runNightly purges short-term rows and sends only chats with long-term memory', async () => {
  const { service, calls } = createService();

  await service.runNightly(new Date('2026-10-26T03:00:00+07:00'));

  assert.deepEqual(calls, ['purge', 'remember zca-g-1 g-1_2026-10-25.txt']);
});

void test('without Cognee the job only purges', async () => {
  const { service, calls } = createService({ enabled: false });

  await service.runNightly();

  assert.deepEqual(calls, ['purge']);
});

void test('a stale day forgets its old document before it is sent again', async () => {
  const { service, calls, saved } = createService({
    existing: {
      channelId: 'g-1',
      day: '2026-10-25',
      status: 'stale',
      cogneeDataId: 'ds:d1',
      attempts: 0,
    },
  });

  await service.ingestChannel(CONFIG);

  assert.deepEqual(calls, ['forget ds d1', 'remember zca-g-1 g-1_2026-10-25.txt']);
  assert.equal(saved[0].status, 'ingested');
  assert.equal(saved[0].cogneeDataId, 'ds:d2');
});

void test('a failed send is counted for a retry; a day without lines needs no Cognee call', async () => {
  const failing = createService({ rememberFails: true });
  await failing.service.ingestChannel(CONFIG);
  assert.equal(failing.saved[0].status, 'failed');
  assert.equal(failing.saved[0].attempts, 1);
  assert.equal(failing.learned.length, 0);

  const empty = createService({ lines: [] });
  await empty.service.ingestChannel(CONFIG);
  assert.equal(empty.saved[0].status, 'ingested');
  assert.ok(!empty.calls.some((call) => call.startsWith('remember')));
});

void test('after a day goes in, the bot and the active members are learned again', async () => {
  const { service, learned } = createService();

  await service.ingestChannel(CONFIG);

  assert.deepEqual(
    learned.map((entry) => [entry.subject.kind, entry.subject.userId, entry.facts]),
    [
      ['bot', null, ['Là chồng Diệu Hằng']],
      ['member', 'u1', ['Là chồng Diệu Hằng']],
    ],
  );
});
