import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FinanceBreakdown, FinanceReportService } from '../../finance/finance-report.service';
import type { FinanceService } from '../../finance/finance.service';
import type { RedisService } from '../../redis/redis.service';
import type { ThreadConfigService } from '../thread-config.service';
import type { ZcaMessengerService } from '../zca-messenger.service';
import { FinanceDigestService, digestRanges } from './finance-digest.service';

const breakdown: FinanceBreakdown = {
  income: 0,
  expense: 0,
  count: 0,
  topCategories: [],
  topTransactions: [],
};

function setup(options: {
  configs: Record<string, { weekly: boolean; monthly: boolean }>;
  connected?: boolean;
  failFor?: string[];
}) {
  const sent: string[] = [];
  const marks = new Map<string, string>();
  const failFor = new Set(options.failFor ?? []);
  const service = new FinanceDigestService(
    { getBreakdown: () => Promise.resolve(breakdown) } as unknown as FinanceReportService,
    { getActiveDebts: () => Promise.resolve([]) } as unknown as FinanceService,
    {
      getListenedThreadIds: () => Object.keys(options.configs),
      getConfig: (id: string) => Promise.resolve({ financeDigest: options.configs[id] }),
    } as unknown as ThreadConfigService,
    {
      isConnected: () => options.connected ?? true,
      sendMessage: (id: string) => {
        if (failFor.has(id)) return Promise.resolve(false);
        sent.push(id);
        return Promise.resolve(true);
      },
    } as unknown as ZcaMessengerService,
    {
      get: (key: string) => Promise.resolve(marks.get(key) ?? null),
      set: (key: string, value: string) => {
        marks.set(key, value);
        return Promise.resolve(true);
      },
    } as unknown as RedisService,
  );
  return { service, sent, failFor };
}

const monday = new Date('2026-11-02T01:00:00Z');

void test('only channels that opted in for that kind receive it', async () => {
  const { service, sent } = setup({
    configs: {
      a: { weekly: true, monthly: false },
      b: { weekly: false, monthly: true },
      c: { weekly: false, monthly: false },
    },
  });
  await service.run('weekly', monday);
  assert.deepEqual(sent, ['a']);
});

void test('a retry reaches the missed channel without repeating the others', async () => {
  const { service, sent, failFor } = setup({
    configs: { a: { weekly: true, monthly: false }, b: { weekly: true, monthly: false } },
    failFor: ['b'],
  });
  await assert.rejects(service.run('weekly', monday), /1 channel/);
  assert.deepEqual(sent, ['a']);

  failFor.clear();
  await service.run('weekly', monday);
  assert.deepEqual(sent, ['a', 'b']);
});

void test('a disconnected bot fails the job so it retries', async () => {
  const { service } = setup({
    configs: { a: { weekly: true, monthly: false } },
    connected: false,
  });
  await assert.rejects(service.run('weekly', monday), /not connected/);
});

void test('nobody opted in means nothing to do, connected or not', async () => {
  const { service } = setup({
    configs: { a: { weekly: false, monthly: false } },
    connected: false,
  });
  assert.equal(await service.run('weekly', monday), 0);
});

void test('the weekly digest covers last Monday to Sunday, compared with the week before', () => {
  const { current, previous } = digestRanges('weekly', monday);
  assert.equal(current.label, 'Tuần trước (26/10–01/11)');
  assert.equal(previous.endAt?.toISOString(), current.startAt?.toISOString());
});

void test('the monthly digest covers last month, compared with the month before', () => {
  const { current, previous } = digestRanges('monthly', new Date('2026-11-01T01:00:00Z'));
  assert.equal(current.label, 'Tháng 10/2026');
  assert.equal(previous.label, 'Tháng 9/2026');
});
