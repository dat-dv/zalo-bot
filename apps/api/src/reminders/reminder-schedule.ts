import {
  type IReminderRule,
  type ReminderRepeatType,
  type ReminderRuleError,
  validateReminderRule,
} from '@zalobot/contracts';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Vietnam is UTC+7 all year (no daylight saving), so local days are fixed 24 h slices. */
const VN_OFFSET_MS = 7 * 60 * MINUTE_MS;
const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5];

/** The repeat part of a rule. */
export interface ReminderRepeat {
  repeatType: ReminderRepeatType;
  repeatWeekdays: readonly number[];
}

export const NO_REMINDER_RULE: IReminderRule = {
  repeatType: 'none',
  repeatWeekdays: [],
  nagEveryMinutes: null,
  nagCount: null,
};

const RULE_ERROR_MESSAGES: Record<ReminderRuleError, string> = {
  nagEvery: 'Nhắc lại mỗi 5 phút đến 24 giờ.',
  nagCount: 'Nhắc lại từ 1 đến 10 lần.',
  nagTooLong: 'Nhắc lại phải kết thúc trước lần lặp kế tiếp.',
  weekdays: 'Thứ trong tuần không hợp lệ.',
};

export function reminderRuleErrorMessage(error: ReminderRuleError): string {
  return RULE_ERROR_MESSAGES[error];
}

/** Weekday (0 = Sunday) and calendar date of an instant, in Vietnam time. */
function vnDate(at: Date): { year: number; month: number; day: number; weekday: number } {
  const local = new Date(at.getTime() + VN_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

/** Milliseconds since Vietnam midnight. */
function vnTimeOfDay(at: Date): number {
  return (((at.getTime() + VN_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The weekdays a time repeats on; empty for repeats that are not day-of-week based. */
function repeatDays(repeat: ReminderRepeat, anchor: Date): readonly number[] {
  if (repeat.repeatType === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (repeat.repeatType === 'weekdays') return MONDAY_TO_FRIDAY;
  if (repeat.repeatType === 'weekly') {
    return repeat.repeatWeekdays.length > 0 ? repeat.repeatWeekdays : [vnDate(anchor).weekday];
  }
  return [];
}

/** `day` of a Vietnam month at `timeOfDay`, on the last day when the month is shorter. */
function vnDayInMonth(year: number, month: number, day: number, timeOfDay: number): number {
  return Date.UTC(year, month, Math.min(day, daysInMonth(year, month))) + timeOfDay - VN_OFFSET_MS;
}

/**
 * The next occurrence of a repeating time strictly after `now` and after `current`, at the same
 * Vietnam time of day; occurrences missed meanwhile are skipped, not sent late. `anchor` is the
 * time as first set: its weekday for a plain weekly repeat, its day of the month for a monthly
 * one (the last day in shorter months, back to the anchor day afterwards), its day and month
 * for a yearly one (28 February outside leap years for 29 February). Null without repeat.
 */
export function nextOccurrence(
  current: Date,
  anchor: Date,
  repeat: ReminderRepeat,
  now: Date,
): Date | null {
  const type: ReminderRepeatType = repeat.repeatType;
  if (type === 'none') return null;
  const after = Math.max(current.getTime(), now.getTime());

  if (type === 'monthly') {
    const anchorDay = vnDate(anchor).day;
    const timeOfDay = vnTimeOfDay(anchor);
    let { year, month } = vnDate(current);
    for (;;) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      const at = vnDayInMonth(year, month, anchorDay, timeOfDay);
      if (at > after) return new Date(at);
    }
  }

  if (type === 'yearly') {
    const { month, day } = vnDate(anchor);
    const timeOfDay = vnTimeOfDay(anchor);
    // From the current year: a time moved off its anchor date may still fall later this year.
    for (let year = vnDate(current).year; ; year += 1) {
      const at = vnDayInMonth(year, month, day, timeOfDay);
      if (at > after) return new Date(at);
    }
  }

  const days = repeatDays(repeat, anchor);
  // Jump close to `now` first, then walk at most one week to the next allowed weekday.
  let at = current.getTime() + DAY_MS;
  if (at <= after) at += Math.floor((after - at) / DAY_MS) * DAY_MS;
  for (let i = 0; i < 15; i += 1, at += DAY_MS) {
    if (at > after && days.includes(vnDate(new Date(at)).weekday)) return new Date(at);
  }
  return null;
}

/**
 * Where a requested time starts: a repeating time already past starts at its next occurrence
 * (missed occurrences are not sent late), any other time as given. The moved time is the new
 * anchor, so a monthly 31st moved into a shorter month keeps that shorter day afterwards.
 */
export function upcomingTime(at: Date, repeat: ReminderRepeat, now: Date): Date {
  if (at.getTime() > now.getTime()) return at;
  return nextOccurrence(at, at, repeat, now) ?? at;
}

/** The remind-again part of a rule, shared by all times of a task or a reminder. */
export interface NagRule {
  nagEveryMinutes: number | null;
  nagCount: number | null;
}

export const NO_NAG_RULE: NagRule = { nagEveryMinutes: null, nagCount: null };
export const NO_REPEAT: ReminderRepeat = { repeatType: 'none', repeatWeekdays: [] };

const REPEATING_TYPES = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as const;

/** A repeat with weekdays sorted and distinct, kept only for a weekly repeat. */
export function normalizeRepeat(repeat: ReminderRepeat): ReminderRepeat {
  return {
    repeatType: repeat.repeatType,
    repeatWeekdays:
      repeat.repeatType === 'weekly'
        ? [...new Set(repeat.repeatWeekdays)].sort((a, b) => a - b)
        : [],
  };
}

/** The repeat of a time row; rows saved before repeats existed do not repeat. */
export function repeatOf(time: {
  repeatType?: string | null;
  repeatWeekdays?: readonly number[] | null;
}): ReminderRepeat {
  const repeatType = REPEATING_TYPES.find((type) => type === time.repeatType) ?? 'none';
  return normalizeRepeat({ repeatType, repeatWeekdays: time.repeatWeekdays ?? [] });
}

export function isSameRepeat(a: ReminderRepeat, b: ReminderRepeat): boolean {
  const x = normalizeRepeat(a);
  const y = normalizeRepeat(b);
  return (
    x.repeatType === y.repeatType &&
    x.repeatWeekdays.length === y.repeatWeekdays.length &&
    x.repeatWeekdays.every((day, i) => day === y.repeatWeekdays[i])
  );
}

/** The remind-again rule of a task or reminder row. */
export function nagRuleOf(row: {
  nagEveryMinutes?: number | null;
  nagCount?: number | null;
}): NagRule {
  return { nagEveryMinutes: row.nagEveryMinutes ?? null, nagCount: row.nagCount ?? null };
}

/** The rule a time follows: its own repeat and its parent's remind-again setting. */
export function timeRule(repeat: ReminderRepeat, nag: NagRule): IReminderRule {
  return { ...normalizeRepeat(repeat), ...nag };
}

/** Remind-again fields of a create or update request; omitted fields keep `current`. */
export interface NagRuleInput {
  nagEveryMinutes?: number | null;
  nagCount?: number | null;
}

export function touchesNagRule(input: NagRuleInput): boolean {
  return input.nagEveryMinutes !== undefined || input.nagCount !== undefined;
}

export function mergeNagRule(current: NagRule, input: NagRuleInput): NagRule {
  return {
    nagEveryMinutes:
      input.nagEveryMinutes !== undefined ? input.nagEveryMinutes : current.nagEveryMinutes,
    nagCount: input.nagCount !== undefined ? input.nagCount : current.nagCount,
  };
}

/**
 * Checks the remind-again setting against every time it applies to: its values must be in
 * range, and it must be over before the next occurrence of each repeating time.
 */
export function checkReminderRules(
  repeats: readonly ReminderRepeat[],
  nag: NagRule,
): ReminderRuleError | null {
  for (const repeat of [NO_REPEAT, ...repeats]) {
    const error = validateReminderRule(timeRule(repeat, nag));
    if (error) return error;
  }
  return null;
}

/** Whether the rule reminds again after each time. */
export function hasNag<T extends NagRule>(
  rule: T,
): rule is T & { nagEveryMinutes: number; nagCount: number } {
  return rule.nagEveryMinutes !== null && rule.nagCount !== null && rule.nagCount > 0;
}

/** When to remind again next: counted from when the reminder actually went out. */
export function nextNagAt(sentAt: Date, everyMinutes: number): Date {
  return new Date(sentAt.getTime() + everyMinutes * MINUTE_MS);
}

/** The scheduling state of a time row (`task_reminder_times` / `reminder_times`). */
export interface ReminderTimeState {
  remindAt: Date;
  sentAt?: Date | null;
  anchorAt?: Date | null;
  nagAt?: Date | null;
  nagLeft?: number;
}

/** One send of a time: the time itself, or its `index`-th of `total` reminders again. */
export interface ReminderOccurrence {
  at: Date;
  nag?: { index: number; total: number };
}

/** What a time row has due now: the time itself first, else its next reminder again. */
export function dueOccurrence(
  time: ReminderTimeState,
  rule: IReminderRule,
  now: Date,
): ReminderOccurrence | null {
  if (!time.sentAt && time.remindAt.getTime() <= now.getTime()) return { at: time.remindAt };
  const left = time.nagLeft ?? 0;
  if (time.nagAt && left > 0 && time.nagAt.getTime() <= now.getTime()) {
    const total = Math.max(rule.nagCount ?? left, left);
    return { at: time.nagAt, nag: { index: total - left + 1, total } };
  }
  return null;
}

/**
 * The state after claiming `occurrence` at `now`. The time itself: a repeating time moves to
 * its next occurrence (keeping its anchor), a one-off one is marked sent; reminding again then
 * starts over. A reminder again counts down, the last one clears `nag_at`.
 */
export function claimedState(
  time: ReminderTimeState,
  rule: IReminderRule,
  occurrence: ReminderOccurrence,
  now: Date,
): Partial<ReminderTimeState> {
  const nag = hasNag(rule) ? rule : null;
  if (occurrence.nag) {
    const left = Math.max((time.nagLeft ?? 0) - 1, 0);
    return {
      nagLeft: left,
      nagAt: left > 0 && nag ? nextNagAt(now, nag.nagEveryMinutes) : null,
    };
  }
  const anchor = time.anchorAt ?? time.remindAt;
  const next = nextOccurrence(time.remindAt, anchor, rule, now);
  return {
    ...(next ? { remindAt: next, anchorAt: anchor } : { sentAt: now }),
    nagAt: nag ? nextNagAt(now, nag.nagEveryMinutes) : null,
    nagLeft: nag ? nag.nagCount : 0,
  };
}

/** The state that gives a claimed occurrence back, so the next scan claims it again. */
export function releasedState(occurrence: ReminderOccurrence): Partial<ReminderTimeState> {
  if (occurrence.nag) {
    return { nagAt: occurrence.at, nagLeft: occurrence.nag.total - occurrence.nag.index + 1 };
  }
  return { sentAt: null, remindAt: occurrence.at, nagAt: null, nagLeft: 0 };
}

/** The state that stops reminding again (task done, reminder done or rule turned off). */
export const NO_NAG_STATE: Pick<ReminderTimeState, 'nagAt' | 'nagLeft'> = {
  nagAt: null,
  nagLeft: 0,
};

/**
 * The state of a time whose repeat changes. A one-off time that already went out and now
 * repeats starts again at its next occurrence; whether it was sent is kept otherwise.
 */
export function repeatChangeState(
  time: ReminderTimeState,
  repeat: ReminderRepeat,
  now: Date = new Date(),
): Partial<ReminderTimeState> & { repeatType: ReminderRepeatType; repeatWeekdays: number[] } {
  const normalized = normalizeRepeat(repeat);
  const columns = {
    repeatType: normalized.repeatType,
    repeatWeekdays: [...normalized.repeatWeekdays],
  };
  if (!time.sentAt || normalized.repeatType === 'none') return columns;
  const anchor = time.anchorAt ?? time.remindAt;
  const next = nextOccurrence(time.remindAt, anchor, normalized, now);
  return next ? { ...columns, sentAt: null, remindAt: next, anchorAt: anchor } : columns;
}
