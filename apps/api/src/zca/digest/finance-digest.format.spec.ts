import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { FinanceBreakdown } from '../../finance/finance-report.service';
import { formatFinanceDigest } from './finance-digest.format';

const now = new Date('2026-11-02T01:00:00Z');
const week: FinanceBreakdown = {
  income: 1_000_000,
  expense: 300_000,
  count: 5,
  topCategories: [
    { category: 'Ăn uống', amount: 200_000 },
    { category: 'Đi lại', amount: 60_000 },
    { category: 'Mua sắm', amount: 30_000 },
    { category: 'Khác', amount: 10_000 },
  ],
  topTransactions: [],
};
const empty: FinanceBreakdown = { ...week, income: 0, expense: 0, count: 0, topCategories: [] };

void test('compares spending with the previous period and keeps the top 3 categories', () => {
  const text = formatFinanceDigest({
    label: 'Tuần trước (26/10–01/11)',
    current: week,
    previous: { ...week, expense: 200_000 },
    debts: [],
    now,
  });
  assert.match(text, /^📅 Tóm tắt Tuần trước \(26\/10–01\/11\)/);
  assert.match(text, /tăng 50% so với kỳ trước/);
  assert.match(text, /Mua sắm/);
  assert.doesNotMatch(text, /Khác/);
  assert.doesNotMatch(text, /Công nợ/);
});

void test('no previous spending means no comparison, never a division by zero', () => {
  const text = formatFinanceDigest({ label: 'x', current: week, previous: empty, debts: [], now });
  assert.doesNotMatch(text, /kỳ trước/);
});

void test('an empty period still reports debts', () => {
  const text = formatFinanceDigest({
    label: 'x',
    current: empty,
    previous: empty,
    debts: [{ direction: 'payable', counterparty: 'Nam', remainingAmount: 100_000 }],
    now,
  });
  assert.match(text, /Không có giao dịch nào/);
  assert.match(text, /phải thu 0đ · phải trả 100\.000đ/);
});

void test('lists debts due soon and overdue, earliest first, ignoring later ones', () => {
  const text = formatFinanceDigest({
    label: 'x',
    current: week,
    previous: week,
    debts: [
      {
        direction: 'receivable',
        counterparty: 'Sau này',
        remainingAmount: 1,
        dueAt: new Date('2026-12-30T00:00:00Z'),
      },
      {
        direction: 'receivable',
        counterparty: 'Sắp tới',
        remainingAmount: 2,
        dueAt: new Date('2026-11-05T00:00:00Z'),
      },
      {
        direction: 'payable',
        counterparty: 'Quá hạn',
        remainingAmount: 3,
        dueAt: new Date('2026-10-20T00:00:00Z'),
      },
    ],
    now,
  });
  assert.match(text, /Đến hạn trong 7 ngày tới: Quá hạn 3đ, Sắp tới 2đ$/m);
});
