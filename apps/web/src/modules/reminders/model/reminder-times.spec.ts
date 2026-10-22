import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReminderTimes,
  emptyReminderTimeDraft,
  hasReminderTime,
  isReminderTimesChanged,
  reminderTimeDraftsFrom,
  snoozeReminderTimes,
} from './reminder-times';

const NOW = new Date('2026-10-22T03:00:00.000Z');
const pad = (n: number) => String(n).padStart(2, '0');
/** `datetime-local` value of a date in the test runner's time zone. */
const localInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
const inHours = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);

test('builds sorted, distinct ISO times and skips empty rows', () => {
  const result = buildReminderTimes(
    [
      { value: localInput(inHours(3)) },
      emptyReminderTimeDraft(),
      { value: localInput(inHours(1)) },
      { value: localInput(inHours(1)) },
    ],
    NOW,
  );
  const iso = [
    new Date(localInput(inHours(1))).toISOString(),
    new Date(localInput(inHours(3))).toISOString(),
  ];
  assert.deepEqual(result, {
    ok: true,
    iso,
    times: iso.map((remindAt) => ({ remindAt, repeatType: 'none', repeatWeekdays: [] })),
  });
});

test('each time carries its own repeat; weekdays only for weekly, sorted', () => {
  const result = buildReminderTimes(
    [
      { value: localInput(inHours(1)), repeatType: 'daily', repeatWeekdays: [3] },
      { value: localInput(inHours(2)), repeatType: 'weekly', repeatWeekdays: [5, 1, 5] },
      { value: localInput(inHours(3)) },
    ],
    NOW,
  );
  assert.ok(result.ok);
  assert.deepEqual(
    result.times.map((time) => [time.repeatType, time.repeatWeekdays]),
    [
      ['daily', []],
      ['weekly', [1, 5]],
      ['none', []],
    ],
  );
});

test('a new past time is rejected, an unchanged saved past time is kept as is', () => {
  assert.deepEqual(buildReminderTimes([{ value: localInput(inHours(-1)) }], NOW), {
    ok: false,
    error: 'pastTime',
  });
  const saved = [{ id: 'a', remindAt: inHours(-1).toISOString(), sentAt: NOW.toISOString() }];
  const drafts = reminderTimeDraftsFrom(saved);
  assert.deepEqual(buildReminderTimes(drafts, NOW), {
    ok: true,
    iso: [saved[0].remindAt],
    times: [{ remindAt: saved[0].remindAt, repeatType: 'none', repeatWeekdays: [] }],
  });
});

test('more than 10 times is rejected', () => {
  const drafts = Array.from({ length: 11 }, (_, i) => ({ value: localInput(inHours(i + 1)) }));
  assert.deepEqual(buildReminderTimes(drafts, NOW), { ok: false, error: 'tooMany' });
});

test('drafts from saved times, change detection, and an empty start row', () => {
  assert.deepEqual(reminderTimeDraftsFrom(undefined), [{ value: '' }]);
  assert.equal(hasReminderTime([{ value: '' }]), false);
  const saved = [{ id: 'a', remindAt: inHours(1).toISOString() }];
  const once = (remindAt: string) => ({
    remindAt,
    repeatType: 'none' as const,
    repeatWeekdays: [],
  });
  assert.equal(isReminderTimesChanged([once(saved[0].remindAt)], saved), false);
  assert.equal(isReminderTimesChanged([], saved), true);
  assert.equal(
    isReminderTimesChanged([once(saved[0].remindAt), once(inHours(2).toISOString())], saved),
    true,
  );
  // Same instant, another repeat: changed.
  assert.equal(
    isReminderTimesChanged([{ ...once(saved[0].remindAt), repeatType: 'daily' }], saved),
    true,
  );
  const drafts = reminderTimeDraftsFrom([
    { id: 'b', remindAt: saved[0].remindAt, repeatType: 'weekly', repeatWeekdays: [2] },
  ]);
  assert.equal(drafts[0].repeatType, 'weekly');
  assert.deepEqual(drafts[0].repeatWeekdays, [2]);
});

test('snooze moves only the next time not sent', () => {
  const saved = [
    { id: 'a', remindAt: inHours(-2).toISOString(), sentAt: NOW.toISOString() },
    { id: 'b', remindAt: inHours(1).toISOString() },
    { id: 'c', remindAt: inHours(5).toISOString() },
  ];
  assert.deepEqual(
    snoozeReminderTimes(saved, 15).map((time) => time.remindAt),
    [
      inHours(-2).toISOString(),
      new Date(inHours(1).getTime() + 15 * 60 * 1000).toISOString(),
      inHours(5).toISOString(),
    ],
  );
});

test('snoozing a repeating time keeps it and adds a one-off time', () => {
  const saved = [{ id: 'a', remindAt: inHours(1).toISOString(), repeatType: 'daily' as const }];
  assert.deepEqual(snoozeReminderTimes(saved, 15), [
    { remindAt: inHours(1).toISOString(), repeatType: 'daily', repeatWeekdays: [] },
    {
      remindAt: new Date(inHours(1).getTime() + 15 * 60 * 1000).toISOString(),
      repeatType: 'none',
      repeatWeekdays: [],
    },
  ]);
});
