import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_ROUTES,
  type IDebtListItem,
  type IRecurringOccurrenceItem,
  type ITaskListItem,
} from '@zalobot/contracts';
import { buildHomeAttention, dueDay, vietnamDay } from './home-attention';

// 10:00 on 04/11/2026 in Vietnam.
const NOW = new Date('2026-11-04T03:00:00.000Z');

const task = (over: Partial<ITaskListItem>): ITaskListItem => ({
  id: over.title ?? 't',
  title: 'Việc',
  status: 'needsAction',
  ...over,
});

const debt = (over: Partial<IDebtListItem>): IDebtListItem =>
  ({
    id: 'd',
    direction: 'payable',
    counterparty: 'An',
    remainingAmount: 100,
    ...over,
  }) as IDebtListItem;

const occurrence = (over: Partial<IRecurringOccurrenceItem>): IRecurringOccurrenceItem => ({
  id: 'o',
  ruleId: 'r',
  type: 'expense',
  note: 'Tiền điện',
  category: 'Nhà',
  amount: null,
  dueAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const attention = (data: {
  tasks?: ITaskListItem[];
  debts?: IDebtListItem[];
  recurringPending?: IRecurringOccurrenceItem[];
}) => buildHomeAttention({ tasks: [], debts: [], recurringPending: [], ...data }, NOW);

void test('vietnamDay turns over at midnight in Vietnam, not UTC', () => {
  assert.equal(vietnamDay(new Date('2026-11-04T16:59:59.000Z')), '2026-11-04');
  assert.equal(vietnamDay(new Date('2026-11-04T17:00:00.000Z')), '2026-11-05');
});

void test('dueDay keeps the day picked on the dashboard', () => {
  assert.equal(dueDay('2026-11-04T23:59:59.000Z'), '2026-11-04');
});

void test('dueDay reads a moment from Zalo in Vietnam time', () => {
  assert.equal(dueDay('2026-11-04T17:00:00.000Z'), '2026-11-05');
  assert.equal(dueDay('2026-11-05T09:00:00+07:00'), '2026-11-05');
});

void test('dueDay ignores a broken date', () => {
  assert.equal(dueDay('not a date'), null);
});

void test('nothing to do gives no rows', () => {
  assert.deepEqual(attention({}), []);
});

void test('a task without a due date or already done never needs attention', () => {
  const rows = attention({
    tasks: [
      task({ title: 'Không hạn' }),
      task({ title: 'Xong', status: 'completed', dueAt: '2026-11-01T23:59:59.000Z' }),
    ],
  });
  assert.deepEqual(rows, []);
});

void test('splits overdue tasks from today, leaves future ones out, oldest first', () => {
  const rows = attention({
    tasks: [
      task({ title: 'Hôm qua', dueAt: '2026-11-03T23:59:59.000Z' }),
      task({ title: 'Tuần trước', dueAt: '2026-10-28T23:59:59.000Z' }),
      task({ title: 'Hôm nay', dueAt: '2026-11-04T23:59:59.000Z' }),
      task({ title: 'Ngày mai', dueAt: '2026-11-05T23:59:59.000Z' }),
    ],
  });
  assert.deepEqual(rows, [
    {
      kind: 'overdueTasks',
      count: 2,
      firstTitle: 'Tuần trước',
      href: APP_ROUTES.tasksAllPeriods,
    },
    {
      kind: 'tasksDueToday',
      count: 1,
      firstTitle: 'Hôm nay',
      href: APP_ROUTES.tasksAllPeriods,
    },
  ]);
});

void test('counts debts overdue or due within 7 days, not later, unpaid or without a date', () => {
  const rows = attention({
    debts: [
      debt({ counterparty: 'Sắp tới', dueAt: '2026-11-11T03:00:00.000Z' }),
      debt({ counterparty: 'Quá hạn', dueAt: '2026-10-01T00:00:00.000Z' }),
      debt({ counterparty: 'Còn lâu', dueAt: '2026-11-11T03:00:01.000Z' }),
      debt({ counterparty: 'Không hạn' }),
      debt({ counterparty: 'Đã trả', dueAt: '2026-10-01T00:00:00.000Z', remainingAmount: 0 }),
      debt({ counterparty: 'Khoản con', dueAt: '2026-10-01T00:00:00.000Z', parentDebtId: 'p' }),
    ],
  });
  assert.deepEqual(rows, [
    { kind: 'debtsDue', count: 2, firstTitle: 'Quá hạn', href: APP_ROUTES.debts },
  ]);
});

void test('every period waiting to be recorded counts, named by its note or category', () => {
  assert.deepEqual(attention({ recurringPending: [occurrence({ note: '' }), occurrence({})] }), [
    { kind: 'recurringPending', count: 2, firstTitle: 'Nhà', href: APP_ROUTES.recurring },
  ]);
});
