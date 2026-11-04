import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FinanceService } from '../../../finance/finance.service';
import type {
  FinanceBreakdown,
  FinanceBreakdownFilter,
  FinanceReportService,
} from '../../../finance/finance-report.service';
import { resolveReportPeriod } from '../../../finance/report-period';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { TextToolContext } from '../text-tool.interface';
import { GetReportToolStrategy, formatFinanceReport } from './get-report-tool.strategy';

const breakdown: FinanceBreakdown = {
  income: 1_000_000,
  expense: 300_000,
  count: 4,
  topCategories: [
    { category: 'Ăn uống', amount: 200_000 },
    { category: 'Đi lại', amount: 100_000 },
  ],
  topTransactions: [{ note: 'ăn tối', amount: 150_000, occurredAt: new Date() }],
};

function setup(places: Array<{ id: string }> = []) {
  const filters: FinanceBreakdownFilter[] = [];
  const replies: string[] = [];
  const strategy = new GetReportToolStrategy(
    {
      sendMessage: (_id: string, message: string) => {
        replies.push(message);
        return Promise.resolve(true);
      },
    } as unknown as ZcaMessengerService,
    {
      getLedgerBalance: () => Promise.resolve(700_000),
      resolvePlaces: () => Promise.resolve(places),
      resolveContacts: () => Promise.resolve([]),
    } as unknown as FinanceService,
    {
      getBreakdown: (filter: FinanceBreakdownFilter) => {
        filters.push(filter);
        return Promise.resolve(breakdown);
      },
    } as unknown as FinanceReportService,
  );
  const run = (toolArgs: Record<string, unknown>) =>
    strategy.execute({ chatId: 'c1', toolArgs } as unknown as TextToolContext);
  return { filters, replies, run };
}

void test('the asked period reaches the query instead of all-time totals', async () => {
  const { filters, replies, run } = setup();
  await run({ period: 'today' });

  const today = resolveReportPeriod('today', new Date());
  assert.deepEqual(filters[0].startAt, today.startAt);
  assert.deepEqual(filters[0].endAt, today.endAt);
  assert.match(replies[0], /^📊 Hôm nay/);
});

void test('with no period the report covers this month and says so', async () => {
  const { filters, replies, run } = setup();
  await run({});

  assert.deepEqual(filters[0].startAt, resolveReportPeriod('this_month', new Date()).startAt);
  assert.match(replies[0], /^📊 Tháng /);
});

void test('a custom range wins over the period', async () => {
  const { filters, replies, run } = setup();
  await run({ period: 'today', startDate: '2026-10-01', endDate: '2026-10-03' });

  assert.equal(filters[0].startAt?.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.match(replies[0], /01\/10\/2026–03\/10\/2026/);
});

void test('a bad date is refused rather than answered for another period', async () => {
  const { filters, replies, run } = setup();
  await run({ startDate: '2026-13-01' });

  assert.equal(filters.length, 0);
  assert.match(replies[0], /không hợp lệ/);
});

void test('an unknown place is reported, never treated as no filter', async () => {
  const { filters, replies, run } = setup();
  await run({ placeName: 'Aeon' });

  assert.equal(filters.length, 0);
  assert.match(replies[0], /Không tìm thấy nơi chốn "Aeon"/);
});

void test('filters reach the query and the heading', async () => {
  const { filters, replies, run } = setup([{ id: 'p1' }]);
  await run({ period: 'this_week', type: 'expense', category: 'Ăn uống', placeName: 'Aeon' });

  assert.equal(filters[0].type, 'expense');
  assert.equal(filters[0].category, 'Ăn uống');
  assert.deepEqual(filters[0].placeIds, ['p1']);
  assert.match(replies[0], /khoản chi · danh mục Ăn uống · tại Aeon/);
});

void test('the wallet balance appears only on an unfiltered report', () => {
  const range = resolveReportPeriod('today', new Date());
  const walletBalance = 700_000;
  assert.match(
    formatFinanceReport({ range, filters: [], breakdown, walletBalance }),
    /Số dư hiện tại 700\.000đ/,
  );
  assert.doesNotMatch(
    formatFinanceReport({ range, filters: ['danh mục Ăn uống'], breakdown, walletBalance }),
    /Số dư/,
  );
});

void test('an empty period says so', () => {
  const range = resolveReportPeriod('today', new Date());
  const empty = { ...breakdown, count: 0 };
  assert.equal(
    formatFinanceReport({ range, filters: [], breakdown: empty, walletBalance: 0 }),
    '📊 Hôm nay: không có giao dịch nào.',
  );
});
