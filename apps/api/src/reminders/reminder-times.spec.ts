import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type StoredReminderTime,
  lastSentReminderAt,
  nextPendingReminderAt,
  planReminderTimes,
  plannedRepeats,
  revivePayloadTimes,
  toReminderTimeItems,
} from './reminder-times';
import { parseRemindTimesBody } from './reminder-rule.body';

const NOW = new Date('2026-10-22T03:00:00.000Z');
const at = (iso: string) => new Date(iso);
/** Requested times without their own repeat. */
const once = (...times: Date[]) => times.map((time) => ({ at: time }));
const DAILY = { repeatType: 'daily', repeatWeekdays: [] } as const;
const ONCE = { repeatType: 'none', repeatWeekdays: [] } as const;

void test('planReminderTimes keeps saved times (sent or not), drops removed ones, adds new', () => {
  const sent: StoredReminderTime = {
    id: 'a',
    remindAt: at('2026-10-22T01:00:00.000Z'),
    sentAt: NOW,
  };
  const pending: StoredReminderTime = { id: 'b', remindAt: at('2026-10-22T05:00:00.000Z') };
  const result = planReminderTimes(
    [sent, pending],
    once(at('2026-10-22T01:00:00.000Z'), at('2026-10-22T07:00:00.000Z')),
    NOW,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.plan.keep, [sent], 'a past time already saved is kept');
  assert.deepEqual(result.plan.remove, [pending]);
  assert.deepEqual(result.plan.add, [{ at: at('2026-10-22T07:00:00.000Z'), repeat: ONCE }]);
  assert.deepEqual(result.plan.repeatChanges, [], 'a time given without repeat keeps its own');
});

void test('planReminderTimes rejects new past times and more than 10 times', () => {
  assert.deepEqual(planReminderTimes([], once(at('2026-10-22T02:00:00.000Z')), NOW), {
    ok: false,
    error: 'pastTime',
  });
  // The current minute still counts as the future.
  assert.equal(planReminderTimes([], once(at('2026-10-22T02:59:30.000Z')), NOW).ok, true);
  const many = once(
    ...Array.from({ length: 11 }, (_, i) => new Date(NOW.getTime() + (i + 1) * 60_000)),
  );
  assert.deepEqual(planReminderTimes([], many, NOW), { ok: false, error: 'tooMany' });
});

void test('planReminderTimes ignores duplicates and invalid dates', () => {
  const result = planReminderTimes(
    [],
    once(at('2026-10-22T05:00:00.000Z'), at('2026-10-22T05:00:00.000Z'), new Date(NaN)),
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

void test('a pending reminder again keeps the next send, even once the time went out', () => {
  const sent = { id: 'a', remindAt: at('2026-10-22T01:00:00.000Z'), sentAt: NOW };
  assert.equal(nextPendingReminderAt([sent]), null);
  const nagAt = at('2026-10-22T03:15:00.000Z');
  assert.deepEqual(nextPendingReminderAt([{ ...sent, nagAt }]), nagAt);
});

void test('each time keeps its own repeat; a kept time can change its repeat', () => {
  const daily: StoredReminderTime = {
    id: 'a',
    remindAt: at('2026-10-23T01:00:00.000Z'),
    repeatType: 'daily',
    repeatWeekdays: [],
  };
  const result = planReminderTimes(
    [daily],
    [
      { at: at('2026-10-23T01:00:00.000Z'), repeat: ONCE },
      {
        at: at('2026-10-25T07:00:00.000Z'),
        repeat: { repeatType: 'weekly', repeatWeekdays: [4, 1] },
      },
    ],
    NOW,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.plan.repeatChanges, [{ time: daily, repeat: ONCE }]);
  assert.deepEqual(result.plan.add[0].repeat, { repeatType: 'weekly', repeatWeekdays: [1, 4] });
  assert.deepEqual(
    plannedRepeats(result.plan).map((repeat) => repeat.repeatType),
    ['none', 'weekly'],
  );
  assert.deepEqual(toReminderTimeItems([daily])[0], {
    id: 'a',
    remindAt: '2026-10-23T01:00:00.000Z',
    sentAt: undefined,
    repeatType: 'daily',
    repeatWeekdays: [],
  });
});

void test('API bodies give times as strings or with their repeat; empty remindAt clears', () => {
  assert.deepEqual(parseRemindTimesBody(['2026-10-22T05:00:00.000Z'], 'x'), [
    { at: at('2026-10-22T05:00:00.000Z') },
  ]);
  assert.deepEqual(
    parseRemindTimesBody(
      [{ remindAt: '2026-10-22T05:00:00.000Z', repeatType: 'daily' }],
      undefined,
    ),
    [{ at: at('2026-10-22T05:00:00.000Z'), repeat: DAILY }],
  );
  assert.deepEqual(parseRemindTimesBody(undefined, '2026-10-22T05:00:00.000Z'), [
    { at: at('2026-10-22T05:00:00.000Z') },
  ]);
  assert.deepEqual(parseRemindTimesBody(undefined, ''), []);
  assert.equal(parseRemindTimesBody(undefined, undefined), undefined);
  assert.throws(() => parseRemindTimesBody([{ remindAt: 'x' }], undefined));
  assert.throws(() =>
    parseRemindTimesBody([{ remindAt: NOW.toISOString(), repeatType: 'yearly' }], undefined),
  );
});

void test('bot payloads revive times and repeats after the Redis round trip', () => {
  const json = JSON.parse(
    JSON.stringify([
      '2026-10-22T05:00:00.000Z',
      { at: new Date('2026-10-22T06:00:00.000Z'), repeat: DAILY },
      { at: 'nope' },
      42,
    ]),
  ) as unknown;
  assert.deepEqual(revivePayloadTimes(json, undefined), [
    { at: at('2026-10-22T05:00:00.000Z') },
    { at: at('2026-10-22T06:00:00.000Z'), repeat: DAILY },
  ]);
  assert.deepEqual(revivePayloadTimes(undefined, '2026-10-22T05:00:00.000Z'), [
    { at: at('2026-10-22T05:00:00.000Z') },
  ]);
});
