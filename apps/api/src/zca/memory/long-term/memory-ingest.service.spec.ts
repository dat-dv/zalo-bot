import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadBotConfig } from '@zalobot/contracts';
import type { Repository } from 'typeorm';
import type { ZcaMemoryIngestionEntity } from '../../../database/entities/zca-memory-ingestion.entity';
import type { ZcaMemorySegmentEntity } from '../../../database/entities/zca-memory-segment.entity';
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

interface SegmentRow {
  channelId: string;
  day: string;
  fromSentAt: Date;
  toSentAt: Date;
  cogneeDataId: string;
}

/** The service with a segment table and a chat whose today lines are `today`. */
function createSegmentService(options: {
  segments?: SegmentRow[];
  today?: Array<{ sentAt: Date; senderName: string | null; text: string }>;
  rememberFails?: boolean;
}) {
  const calls: string[] = [];
  const segments = [...(options.segments ?? [])];
  const afters: Array<Date | undefined> = [];
  const chatMemory = {
    timeZone: () => 'Asia/Ho_Chi_Minh',
    daysToIngest: () => Promise.resolve([]),
    dayLines: (_channelId: string, _day: string, _tz: string, after?: Date) => {
      afters.push(after);
      return Promise.resolve((options.today ?? []).filter((line) => !after || line.sentAt > after));
    },
  } as unknown as ChatMemoryService;
  const cognee = {
    isEnabled: () => true,
    remember: (dataset: string, fileName: string, text: string) => {
      calls.push(`remember ${dataset} ${fileName} ${text.split('\n')[0]}`);
      return Promise.resolve(options.rememberFails ? null : { datasetId: 'ds', dataId: 'seg2' });
    },
    forget: (datasetId: string, dataId: string) => {
      calls.push(`forget ${datasetId} ${dataId}`);
      return Promise.resolve(true);
    },
  } as unknown as CogneeClient;
  const segmentRepository = {
    findOne: ({ where }: { where: { channelId: string; day: string } }) =>
      Promise.resolve(
        segments
          .filter((row) => row.channelId === where.channelId && row.day === where.day)
          .sort((a, b) => b.toSentAt.getTime() - a.toSentAt.getTime())[0] ?? null,
      ),
    find: ({ where }: { where: { channelId: string; day: string } }) =>
      Promise.resolve(
        segments.filter((row) => row.channelId === where.channelId && row.day === where.day),
      ),
    create: (row: SegmentRow) => ({ ...row }),
    save: (row: SegmentRow) => {
      segments.push(row);
      return Promise.resolve(row);
    },
    delete: ({ channelId, day }: { channelId: string; day: string }) => {
      for (let i = segments.length - 1; i >= 0; i -= 1) {
        if (segments[i].channelId === channelId && segments[i].day === day) segments.splice(i, 1);
      }
      return Promise.resolve({ affected: 1 });
    },
  } as unknown as Repository<ZcaMemorySegmentEntity>;
  const ingestionRepository = {
    findOne: () => Promise.resolve(null),
    create: (row: Partial<ZcaMemoryIngestionEntity>) => ({ ...row }),
    save: (row: Partial<ZcaMemoryIngestionEntity>) => Promise.resolve(row),
    find: () => Promise.resolve([]),
  } as unknown as Repository<ZcaMemoryIngestionEntity>;
  const threadConfig = {
    getAllConfigs: () => [CONFIG],
    findStoredConfig: (id: string) => Promise.resolve(id === 'g-1' ? CONFIG : undefined),
  } as unknown as ThreadConfigService;
  const service = new MemoryIngestService(
    threadConfig,
    chatMemory,
    cognee,
    {} as LearnedFactsService,
    {} as LlmService,
    ingestionRepository,
    undefined,
    segmentRepository,
  );
  return { service, calls, segments, afters };
}

const NOW = new Date('2026-10-26T08:00:00Z'); // 15:00 in Vietnam
const AT_1428 = new Date('2026-10-26T07:28:00Z');
const AT_1456 = new Date('2026-10-26T07:56:00Z');

void test('a segment sends only today lines after the last segment, with its time range', async () => {
  const { service, calls, segments, afters } = createSegmentService({
    segments: [
      {
        channelId: 'g-1',
        day: '2026-10-26',
        fromSentAt: AT_1428,
        toSentAt: AT_1428,
        cogneeDataId: 'ds:seg1',
      },
    ],
    today: [
      { sentAt: AT_1428, senderName: 'Văn Đạt', text: 'c.datintech.site' },
      { sentAt: AT_1456, senderName: 'Diệu Hằng', text: 'ok' },
    ],
  });

  assert.equal(await service.ingestSegment(CONFIG, NOW), 1);
  assert.equal(afters[0]?.getTime(), AT_1428.getTime());
  assert.deepEqual(calls, [
    `remember zca-g-1 g-1_2026-10-26_${AT_1456.getTime()}.txt Nhật ký cuộc trò chuyện "Gia đình" ngày 26/10/2026 (Thứ Hai), 14:56–14:56`,
  ]);
  assert.equal(segments.length, 2);
  assert.equal(segments[1].cogneeDataId, 'ds:seg2');
  assert.equal(segments[1].toSentAt.getTime(), AT_1456.getTime());
});

void test('a segment without new lines, or that Cognee refuses, marks nothing', async () => {
  const quiet = createSegmentService({ today: [] });
  assert.equal(await quiet.service.ingestSegment(CONFIG, NOW), 0);
  assert.deepEqual(quiet.calls, []);

  const failing = createSegmentService({
    today: [{ sentAt: AT_1456, senderName: 'Đạt', text: 'hi' }],
    rememberFails: true,
  });
  assert.equal(await failing.service.ingestSegment(CONFIG, NOW), null);
  assert.equal(failing.segments.length, 0, 'the next run sends these lines again');
});

void test('the nightly day forgets the segments of that day before sending the whole day', async () => {
  const { service, calls, segments } = createSegmentService({
    segments: [
      {
        channelId: 'g-1',
        day: '2026-10-25',
        fromSentAt: AT_1428,
        toSentAt: AT_1428,
        cogneeDataId: 'ds:old',
      },
    ],
    today: [{ sentAt: new Date('2026-10-25T07:28:00Z'), senderName: 'Đạt', text: 'hi' }],
  });
  const internals = service as unknown as {
    ingestDay(config: ThreadBotConfig, day: string, tz: string): Promise<boolean>;
  };

  await internals.ingestDay(CONFIG, '2026-10-25', 'Asia/Ho_Chi_Minh');

  assert.equal(calls[0], 'forget ds old');
  assert.match(calls[1], /^remember zca-g-1 g-1_2026-10-25\.txt /);
  assert.equal(segments.length, 0);
});

void test('a recall of a message of today forgets today and sends it again', async () => {
  const { service, calls, segments } = createSegmentService({
    segments: [
      {
        channelId: 'g-1',
        day: '2026-10-26',
        fromSentAt: AT_1428,
        toSentAt: AT_1456,
        cogneeDataId: 'ds:seg1',
      },
    ],
    today: [{ sentAt: AT_1428, senderName: 'Văn Đạt', text: 'c.datintech.site' }],
  });

  assert.equal(await service.runSegment('g-1', { resetToday: true }, NOW), 1);
  assert.equal(calls[0], 'forget ds seg1');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].cogneeDataId, 'ds:seg2');
});

void test('/sync reports what went in; chats without long-term memory get null', async () => {
  const { service } = createSegmentService({
    today: [{ sentAt: AT_1456, senderName: 'Đạt', text: 'hi' }],
  });

  assert.deepEqual(await service.runSync('g-1', NOW), { days: 0, todayLines: 1, failed: false });
  assert.equal(await service.runSync('g-unknown', NOW), null);
});
