import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReminderRule } from '@zalobot/contracts';
import {
  NO_REMINDER_RULE,
  claimedState,
  dueOccurrence,
  NO_NAG_RULE,
  NO_REPEAT,
  checkReminderRules,
  isSameRepeat,
  mergeNagRule,
  normalizeRepeat,
  repeatOf,
  nextNagAt,
  nextOccurrence,
  type ReminderTimeState,
  releasedState,
} from './reminder-schedule';

/** An instant given in Vietnam time (UTC+7). */
const vn = (iso: string) => new Date(`${iso}+07:00`);
const iso = (at: Date | null) => at?.toISOString() ?? null;

// 2026-10-23 is a Friday.
const FRI_9AM = vn('2026-10-23T09:00:00');

void test('daily moves to the next day, skipping days missed meanwhile', () => {
  const daily = { repeatType: 'daily', repeatWeekdays: [] } as const;
  assert.equal(
    iso(nextOccurrence(FRI_9AM, FRI_9AM, daily, FRI_9AM)),
    iso(vn('2026-10-24T09:00:00')),
  );
  // Down for three days: the missed ones are not sent late.
  assert.equal(
    iso(nextOccurrence(FRI_9AM, FRI_9AM, daily, vn('2026-10-27T10:00:00'))),
    iso(vn('2026-10-28T09:00:00')),
  );
});

void test('weekdays skip Saturday and Sunday', () => {
  const weekdays = { repeatType: 'weekdays', repeatWeekdays: [] } as const;
  assert.equal(
    iso(nextOccurrence(FRI_9AM, FRI_9AM, weekdays, FRI_9AM)),
    iso(vn('2026-10-26T09:00:00')),
  );
});

void test('weekly repeats on the weekday of the time, or on the picked weekdays', () => {
  const plain = { repeatType: 'weekly', repeatWeekdays: [] } as const;
  assert.equal(
    iso(nextOccurrence(FRI_9AM, FRI_9AM, plain, FRI_9AM)),
    iso(vn('2026-10-30T09:00:00')),
  );
  // Tuesday and Thursday: from Friday the next is Tuesday, then Thursday, then Tuesday again.
  const tueThu = { repeatType: 'weekly', repeatWeekdays: [2, 4] } as const;
  const tue = nextOccurrence(FRI_9AM, FRI_9AM, tueThu, FRI_9AM);
  assert.equal(iso(tue), iso(vn('2026-10-27T09:00:00')));
  assert.ok(tue);
  const thu = nextOccurrence(tue, FRI_9AM, tueThu, tue);
  assert.equal(iso(thu), iso(vn('2026-10-29T09:00:00')));
});

void test('monthly keeps the day of the month, using the last day of shorter months', () => {
  const monthly = { repeatType: 'monthly', repeatWeekdays: [] } as const;
  const jan31 = vn('2027-01-31T08:00:00');
  const feb = nextOccurrence(jan31, jan31, monthly, jan31);
  assert.equal(iso(feb), iso(vn('2027-02-28T08:00:00')));
  assert.ok(feb);
  // Back to the 31st once the month has one.
  const mar = nextOccurrence(feb, jan31, monthly, feb);
  assert.equal(iso(mar), iso(vn('2027-03-31T08:00:00')));
  // Leap year.
  const jan31Leap = vn('2028-01-31T08:00:00');
  assert.equal(
    iso(nextOccurrence(jan31Leap, jan31Leap, monthly, jan31Leap)),
    iso(vn('2028-02-29T08:00:00')),
  );
});

void test('the Vietnam day is used near midnight', () => {
  // 00:30 Saturday in Vietnam is still Friday in UTC.
  const sat0030 = vn('2026-10-24T00:30:00');
  const weekdays = { repeatType: 'weekdays', repeatWeekdays: [] } as const;
  assert.equal(
    iso(nextOccurrence(sat0030, sat0030, weekdays, sat0030)),
    iso(vn('2026-10-26T00:30:00')),
  );
});

void test('no repeat has no next occurrence', () => {
  assert.equal(nextOccurrence(FRI_9AM, FRI_9AM, NO_REMINDER_RULE, FRI_9AM), null);
});

void test('reminding again needs both values in range, and must end before the next repeat', () => {
  const rule = { ...NO_REMINDER_RULE, nagEveryMinutes: 15, nagCount: 3 };
  assert.equal(validateReminderRule(rule), null);
  assert.equal(validateReminderRule({ ...rule, nagEveryMinutes: 4 }), 'nagEvery');
  assert.equal(validateReminderRule({ ...rule, nagEveryMinutes: 1441 }), 'nagEvery');
  assert.equal(validateReminderRule({ ...rule, nagCount: 11 }), 'nagCount');
  assert.equal(validateReminderRule({ ...rule, nagCount: null }), 'nagCount');
  // 10 × 3 h = 30 h does not fit before the next day.
  const daily = { ...rule, repeatType: 'daily' as const, nagEveryMinutes: 180, nagCount: 10 };
  assert.equal(validateReminderRule(daily), 'nagTooLong');
  // Monday and Tuesday are one day apart.
  const monTue = {
    ...rule,
    repeatType: 'weekly' as const,
    repeatWeekdays: [1, 2],
    nagEveryMinutes: 1440,
    nagCount: 1,
  };
  assert.equal(validateReminderRule(monTue), 'nagTooLong');
  assert.equal(validateReminderRule({ ...monTue, repeatWeekdays: [7] }), 'weekdays');
});

void test('a repeat keeps weekdays sorted and only for weekly', () => {
  assert.deepEqual(normalizeRepeat({ repeatType: 'weekly', repeatWeekdays: [4, 2, 4] }), {
    repeatType: 'weekly',
    repeatWeekdays: [2, 4],
  });
  assert.deepEqual(
    normalizeRepeat({ repeatType: 'daily', repeatWeekdays: [2] }).repeatWeekdays,
    [],
  );
  assert.ok(
    isSameRepeat(
      { repeatType: 'weekly', repeatWeekdays: [4, 2] },
      { repeatType: 'weekly', repeatWeekdays: [2, 4] },
    ),
  );
});

void test('rows saved before repeats existed do not repeat', () => {
  assert.deepEqual(repeatOf({}), NO_REPEAT);
  assert.deepEqual(repeatOf({ repeatType: 'bogus' }), NO_REPEAT);
  assert.deepEqual(repeatOf({ repeatType: 'weekly', repeatWeekdays: [3] }), {
    repeatType: 'weekly',
    repeatWeekdays: [3],
  });
});

void test('reminding again is checked against every time it applies to', () => {
  const nag = { nagEveryMinutes: 600, nagCount: 3 };
  // 30 h fits a one-off time and a weekly one, not a daily one.
  assert.equal(
    checkReminderRules([NO_REPEAT, { repeatType: 'weekly', repeatWeekdays: [] }], nag),
    null,
  );
  assert.equal(
    checkReminderRules([NO_REPEAT, { repeatType: 'daily', repeatWeekdays: [] }], nag),
    'nagTooLong',
  );
  // Out of range even without any time.
  assert.equal(checkReminderRules([], { nagEveryMinutes: 1, nagCount: 1 }), 'nagEvery');
  assert.equal(checkReminderRules([], { nagEveryMinutes: 10, nagCount: null }), 'nagCount');
  assert.equal(
    checkReminderRules([{ repeatType: 'weekly', repeatWeekdays: [9] }], NO_NAG_RULE),
    'weekdays',
  );
});

void test('merging the remind-again rule keeps omitted fields, null turns it off', () => {
  const on = { nagEveryMinutes: 15, nagCount: 3 };
  assert.deepEqual(mergeNagRule(on, { nagCount: 2 }), { nagEveryMinutes: 15, nagCount: 2 });
  assert.deepEqual(mergeNagRule(on, { nagEveryMinutes: null, nagCount: null }), NO_NAG_RULE);
});

void test('reminding again is counted from when the reminder went out', () => {
  assert.equal(
    nextNagAt(vn('2026-10-23T09:02:00'), 15).toISOString(),
    vn('2026-10-23T09:17:00').toISOString(),
  );
});

void test('a one-off time is sent once, then reminded again every X minutes N times', () => {
  const rule = { ...NO_REMINDER_RULE, nagEveryMinutes: 15, nagCount: 2 };
  let state = {
    remindAt: FRI_9AM,
    sentAt: null as Date | null,
    nagAt: null as Date | null,
    nagLeft: 0,
  };
  const sentAt = vn('2026-10-23T09:00:20');
  const first = dueOccurrence(state, rule, sentAt);
  assert.deepEqual(first, { at: FRI_9AM });
  assert.ok(first);
  state = { ...state, ...claimedState(state, rule, first, sentAt) };
  assert.equal(state.sentAt?.toISOString(), sentAt.toISOString());
  assert.equal(state.nagLeft, 2);
  assert.equal(dueOccurrence(state, rule, vn('2026-10-23T09:10:00')), null);

  const nagTime = vn('2026-10-23T09:15:30');
  const nag1 = dueOccurrence(state, rule, nagTime);
  assert.deepEqual(nag1?.nag, { index: 1, total: 2 });
  assert.ok(nag1);
  state = { ...state, ...claimedState(state, rule, nag1, nagTime) };
  assert.equal(state.nagLeft, 1);
  const lastTime = vn('2026-10-23T09:31:00');
  const nag2 = dueOccurrence(state, rule, lastTime);
  assert.deepEqual(nag2?.nag, { index: 2, total: 2 });
  assert.ok(nag2);
  state = { ...state, ...claimedState(state, rule, nag2, lastTime) };
  assert.equal(state.nagAt, null);
  assert.equal(dueOccurrence(state, rule, vn('2026-10-24T00:00:00')), null);
});

void test('a repeating time moves on and keeps its anchor; giving it back restores it', () => {
  const rule = { ...NO_REMINDER_RULE, repeatType: 'monthly' as const };
  const jan31 = vn('2027-01-31T08:00:00');
  const time: ReminderTimeState = { remindAt: jan31, sentAt: null, anchorAt: null };
  const occurrence = dueOccurrence(time, rule, jan31);
  assert.ok(occurrence);
  const claimed = claimedState(time, rule, occurrence, jan31);
  assert.equal(claimed.remindAt?.toISOString(), vn('2027-02-28T08:00:00').toISOString());
  assert.equal(claimed.anchorAt?.toISOString(), jan31.toISOString());
  assert.equal(claimed.sentAt, undefined);
  assert.deepEqual(releasedState(occurrence), {
    sentAt: null,
    remindAt: jan31,
    nagAt: null,
    nagLeft: 0,
  });
  assert.deepEqual(releasedState({ at: jan31, nag: { index: 2, total: 3 } }), {
    nagAt: jan31,
    nagLeft: 2,
  });
});
