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
  assert.deepEqual(result, {
    ok: true,
    iso: [
      new Date(localInput(inHours(1))).toISOString(),
      new Date(localInput(inHours(3))).toISOString(),
    ],
  });
});

test('a new past time is rejected, an unchanged saved past time is kept as is', () => {
  assert.deepEqual(buildReminderTimes([{ value: localInput(inHours(-1)) }], NOW), {
    ok: false,
    error: 'pastTime',
  });
  const saved = [{ id: 'a', remindAt: inHours(-1).toISOString(), sentAt: NOW.toISOString() }];
  const drafts = reminderTimeDraftsFrom(saved);
  assert.deepEqual(buildReminderTimes(drafts, NOW), { ok: true, iso: [saved[0].remindAt] });
});

test('more than 10 times is rejected', () => {
  const drafts = Array.from({ length: 11 }, (_, i) => ({ value: localInput(inHours(i + 1)) }));
  assert.deepEqual(buildReminderTimes(drafts, NOW), { ok: false, error: 'tooMany' });
});

test('drafts from saved times, change detection, and an empty start row', () => {
  assert.deepEqual(reminderTimeDraftsFrom(undefined), [{ value: '' }]);
  assert.equal(hasReminderTime([{ value: '' }]), false);
  const saved = [{ id: 'a', remindAt: inHours(1).toISOString() }];
  assert.equal(isReminderTimesChanged([saved[0].remindAt], saved), false);
  assert.equal(isReminderTimesChanged([], saved), true);
  assert.equal(isReminderTimesChanged([saved[0].remindAt, inHours(2).toISOString()], saved), true);
});

test('snooze moves only the next time not sent', () => {
  const saved = [
    { id: 'a', remindAt: inHours(-2).toISOString(), sentAt: NOW.toISOString() },
    { id: 'b', remindAt: inHours(1).toISOString() },
    { id: 'c', remindAt: inHours(5).toISOString() },
  ];
  assert.deepEqual(snoozeReminderTimes(saved, 15), [
    inHours(-2).toISOString(),
    new Date(inHours(1).getTime() + 15 * 60 * 1000).toISOString(),
    inHours(5).toISOString(),
  ]);
});
