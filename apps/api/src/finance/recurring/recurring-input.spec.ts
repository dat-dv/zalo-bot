import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { ICreateRecurringRequest } from '@zalobot/contracts';
import { parseRecurringInput } from './recurring-input';

const base: ICreateRecurringRequest = {
  type: 'expense',
  note: 'Tiền nhà',
  amount: 5_000_000,
  repeatType: 'monthly',
  startAt: '2026-12-01T01:00:00.000Z',
  mode: 'auto',
};

void test('a valid rule is normalized', () => {
  const input = parseRecurringInput({ ...base, note: '  Tiền nhà ', category: ' ' });
  assert.equal(input.note, 'Tiền nhà');
  assert.equal(input.category, 'Khác');
  assert.equal(input.notifyChatId, null);
});

void test('a self-recording rule cannot go without an amount', () => {
  assert.throws(() => parseRecurringInput({ ...base, amount: null }), /số tiền cố định/);
  assert.equal(parseRecurringInput({ ...base, amount: null, mode: 'confirm' }).amount, null);
});

void test('bad values are refused with a readable message', () => {
  assert.throws(() => parseRecurringInput({ ...base, amount: -1 }), /lớn hơn 0/);
  assert.throws(() => parseRecurringInput({ ...base, note: ' ' }), /tên khoản/);
  assert.throws(() => parseRecurringInput({ ...base, startAt: 'mai' }), /Ngày bắt đầu/);
  assert.throws(() => parseRecurringInput({ ...base, repeatWeekdays: [9] }), /Thứ trong tuần/);
});

void test('"none" is not a repeat: a one-off belongs in a normal transaction', () => {
  const body = { ...base, repeatType: 'none' } as unknown as ICreateRecurringRequest;
  assert.throws(() => parseRecurringInput(body), /Kiểu lặp/);
});

void test('weekdays are kept only for a weekly repeat', () => {
  assert.deepEqual(parseRecurringInput({ ...base, repeatWeekdays: [1] }).repeatWeekdays, []);
  assert.deepEqual(
    parseRecurringInput({ ...base, repeatType: 'weekly', repeatWeekdays: [3, 1, 3] })
      .repeatWeekdays,
    [1, 3],
  );
});
