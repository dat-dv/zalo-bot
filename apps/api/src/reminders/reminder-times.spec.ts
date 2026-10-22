import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type StoredReminderTime,
  lastSentReminderAt,
  nextPendingReminderAt,
  nextRepeatAt,
  planReminderTimes,
  requestedReminderTimes,
  toReminderTimeItems,
} from './reminder-times';

const NOW = new Date('2026-10-22T03:00:00.000Z');
const at = (iso: string) => new Date(iso);

void test('planReminderTimes keeps saved times (sent or not), drops removed ones, adds new', () => {
  const sent: StoredReminderTime = {
    id: 'a',
    remindAt: at('2026-10-22T01:00:00.000Z'),
    sentAt: NOW,
  };
  const pending: StoredReminderTime = { id: 'b', remindAt: at('2026-10-22T05:00:00.000Z') };
  const result = planReminderTimes(
    [sent, pending],
    [at('2026-10-22T01:00:00.000Z'), at('2026-10-22T07:00:00.000Z')],
    NOW,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.plan.keep, [sent], 'a past time already saved is kept');
  assert.deepEqual(result.plan.remove, [pending]);
  assert.deepEqual(result.plan.add, [at('2026-10-22T07:00:00.000Z')]);
});

void test('planReminderTimes rejects new past times and more than 10 times', () => {
  assert.deepEqual(planReminderTimes([], [at('2026-10-22T02:00:00.000Z')], NOW), {
    ok: false,
    error: 'pastTime',
  });
  // The current minute still counts as the future.
  assert.equal(planReminderTimes([], [at('2026-10-22T02:59:30.000Z')], NOW).ok, true);
  const many = Array.from({ length: 11 }, (_, i) => new Date(NOW.getTime() + (i + 1) * 60_000));
  assert.deepEqual(planReminderTimes([], many, NOW), { ok: false, error: 'tooMany' });
});

void test('planReminderTimes ignores duplicates and invalid dates', () => {
  const result = planReminderTimes(
    [],
    [at('2026-10-22T05:00:00.000Z'), at('2026-10-22T05:00:00.000Z'), new Date(NaN)],
    NOW,
  );
  assert.ok(result.ok);
  assert.equal(result.plan.add.length, 1);
});

void test('next pending and last sent times', () => {
  const times = [
    { id: 'a', remindAt: at('2026-10-22T01:00:00.000Z'), sentAt: at('2026-10-22T01:00:05.000Z') },
    { id: 'b', remindAt: at('2026-10-22T09:00:00.000Z'), sentAt: null },
    { id: 'c', remindAt: at('2026-10-22T05:00:00.000Z') },
  ];
  assert.deepEqual(nextPendingReminderAt(times), at('2026-10-22T05:00:00.000Z'));
  assert.deepEqual(lastSentReminderAt(times), at('2026-10-22T01:00:05.000Z'));
  assert.equal(nextPendingReminderAt([times[0]]), null);
  assert.deepEqual(
    toReminderTimeItems(times).map((t) => t.id),
    ['a', 'c', 'b'],
  );
});

void test('nextRepeatAt skips occurrences missed while the bot was down', () => {
  const due = at('2026-10-19T01:00:00.000Z');
  assert.deepEqual(nextRepeatAt(due, 'daily', NOW), at('2026-10-23T01:00:00.000Z'));
  assert.deepEqual(nextRepeatAt(due, 'weekly', NOW), at('2026-10-26T01:00:00.000Z'));
});

void test('requestedReminderTimes prefers remindTimes; empty remindAt clears', () => {
  assert.deepEqual(requestedReminderTimes(['2026-10-22T05:00:00.000Z'], 'x'), [
    at('2026-10-22T05:00:00.000Z'),
  ]);
  assert.deepEqual(requestedReminderTimes(undefined, '2026-10-22T05:00:00.000Z'), [
    at('2026-10-22T05:00:00.000Z'),
  ]);
  assert.deepEqual(requestedReminderTimes(undefined, ''), []);
  assert.equal(requestedReminderTimes(undefined, undefined), undefined);
});
