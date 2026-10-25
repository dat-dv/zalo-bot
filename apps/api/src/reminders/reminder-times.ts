import { REMINDER_TIME_LIMITS, type IReminderTime } from '@zalobot/contracts';
import {
  NO_REPEAT,
  type ReminderRepeat,
  isSameRepeat,
  normalizeRepeat,
  repeatOf,
  upcomingTime,
} from './reminder-schedule';

/** The dashboard picks reminder times by the minute, so the current minute is not "past". */
export const REMINDER_PAST_TOLERANCE_MS = 60 * 1000;

/** A saved reminder time (a `task_reminder_times` or `reminder_times` row). */
export interface StoredReminderTime {
  id: string;
  remindAt: Date;
  sentAt?: Date | null;
  /** When to remind again next (`nag_at`); null when not reminding again. */
  nagAt?: Date | null;
  repeatType?: string | null;
  repeatWeekdays?: number[] | null;
}

/** A requested time; without `repeat` a new time is sent once and a saved one keeps its own. */
export interface RequestedReminderTime {
  at: Date;
  repeat?: ReminderRepeat;
}

/** A time to add, with its repeat. */
export interface NewReminderTime {
  at: Date;
  repeat: ReminderRepeat;
}

export type ReminderTimesError = 'tooMany' | 'pastTime';

/** How to turn the saved times into the requested ones. */
export interface ReminderTimesPlan<T extends StoredReminderTime> {
  keep: T[];
  remove: T[];
  add: NewReminderTime[];
  /** Kept times whose repeat changes; whether they were sent is kept. */
  repeatChanges: Array<{ time: T; repeat: ReminderRepeat }>;
}

export type ReminderTimesPlanResult<T extends StoredReminderTime> =
  { ok: true; plan: ReminderTimesPlan<T> } | { ok: false; error: ReminderTimesError };

const ERROR_MESSAGES: Record<ReminderTimesError, string> = {
  tooMany: `Chỉ đặt tối đa ${REMINDER_TIME_LIMITS.MAX_TIMES} lần nhắc.`,
  pastTime: 'Thời điểm nhắc phải ở tương lai.',
};

export function reminderTimesErrorMessage(error: ReminderTimesError): string {
  return ERROR_MESSAGES[error];
}

/**
 * Requested times from dates or requested times; `repeat` (a legacy whole-reminder repeat)
 * fills the times that come without their own.
 */
export function asRequestedTimes(
  times: readonly (Date | RequestedReminderTime)[],
  repeat?: ReminderRepeat,
): RequestedReminderTime[] {
  return times.map((time) => {
    const requested = time instanceof Date ? { at: time } : time;
    return requested.repeat || !repeat ? requested : { ...requested, repeat };
  });
}

/** The times with each repeating one already past moved to its next occurrence. */
export function withUpcomingRepeats(
  times: readonly RequestedReminderTime[],
  now: Date,
): RequestedReminderTime[] {
  return times.map((time) =>
    time.repeat ? { ...time, at: upcomingTime(time.at, time.repeat, now) } : time,
  );
}

/** Valid, distinct times (the first one of an instant wins), earliest first. */
export function normalizeReminderTimes(
  times: readonly RequestedReminderTime[],
): RequestedReminderTime[] {
  const seen = new Set<number>();
  const result: RequestedReminderTime[] = [];
  for (const time of times) {
    const ms = time.at.getTime();
    if (Number.isNaN(ms) || seen.has(ms)) continue;
    seen.add(ms);
    result.push({
      at: new Date(ms),
      ...(time.repeat ? { repeat: normalizeRepeat(time.repeat) } : {}),
    });
  }
  return result.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Replacing the saved times with the requested ones: a time already saved (same instant; a
 * repeating time is matched on its next occurrence) is kept with whether it was sent, so
 * editing other times never re-sends it; only its repeat may change. New times must be in the
 * future unless `allowPast` (personal reminders: a past time simply goes out at once, as it
 * always did).
 */
export function planReminderTimes<T extends StoredReminderTime>(
  current: readonly T[],
  requested: readonly RequestedReminderTime[],
  now: Date = new Date(),
  options: { allowPast?: boolean } = {},
): ReminderTimesPlanResult<T> {
  const wanted = normalizeReminderTimes(requested);
  if (wanted.length > REMINDER_TIME_LIMITS.MAX_TIMES) return { ok: false, error: 'tooMany' };
  const byMs = new Map(wanted.map((time) => [time.at.getTime(), time]));
  const currentMs = new Set(current.map((time) => time.remindAt.getTime()));
  const add = wanted
    .filter((time) => !currentMs.has(time.at.getTime()))
    .map((time) => ({ at: time.at, repeat: time.repeat ?? NO_REPEAT }));
  const pastLimit = now.getTime() - REMINDER_PAST_TOLERANCE_MS;
  if (!options.allowPast && add.some((time) => time.at.getTime() < pastLimit)) {
    return { ok: false, error: 'pastTime' };
  }
  const keep = current.filter((time) => byMs.has(time.remindAt.getTime()));
  const repeatChanges = keep.flatMap((time) => {
    const repeat = byMs.get(time.remindAt.getTime())?.repeat;
    return repeat && !isSameRepeat(repeat, repeatOf(time)) ? [{ time, repeat }] : [];
  });
  return {
    ok: true,
    plan: {
      keep,
      remove: current.filter((time) => !byMs.has(time.remindAt.getTime())),
      add,
      repeatChanges,
    },
  };
}

/** The repeats the times have once `plan` is applied. */
export function plannedRepeats<T extends StoredReminderTime>(
  plan: ReminderTimesPlan<T>,
): ReminderRepeat[] {
  const changed = new Map(plan.repeatChanges.map((change) => [change.time.id, change.repeat]));
  return [
    ...plan.keep.map((time) => changed.get(time.id) ?? repeatOf(time)),
    ...plan.add.map((time) => time.repeat),
  ];
}

/**
 * The earliest send still to come: a time not sent yet or a pending reminder again; null when
 * nothing is left (a one-off reminder is only done once its reminders again went out too).
 */
export function nextPendingReminderAt(times: readonly StoredReminderTime[]): Date | null {
  let next: Date | null = null;
  for (const time of times) {
    for (const at of [time.sentAt ? null : time.remindAt, time.nagAt ?? null]) {
      if (at && (!next || at.getTime() < next.getTime())) next = at;
    }
  }
  return next;
}

/** When the last time went out, or null when none did. */
export function lastSentReminderAt(times: readonly StoredReminderTime[]): Date | null {
  let last: Date | null = null;
  for (const time of times) {
    if (time.sentAt && (!last || time.sentAt.getTime() > last.getTime())) last = time.sentAt;
  }
  return last;
}

/** DTOs of the times, earliest first. */
export function toReminderTimeItems(times: readonly StoredReminderTime[]): IReminderTime[] {
  return [...times]
    .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
    .map((time) => {
      const repeat = repeatOf(time);
      return {
        id: time.id,
        remindAt: time.remindAt.toISOString(),
        sentAt: time.sentAt?.toISOString(),
        ...(repeat.repeatType !== 'none'
          ? { repeatType: repeat.repeatType, repeatWeekdays: [...repeat.repeatWeekdays] }
          : {}),
      };
    });
}

/**
 * A reminder time as a bot payload carries it: a date, an ISO string (pending actions go
 * through Redis as JSON), or a time with its repeat.
 */
export type PayloadReminderTime =
  string | Date | { at: string | Date; repeat?: Partial<ReminderRepeat> };

function payloadDate(value: unknown): Date | null {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' && value.trim()
        ? new Date(value)
        : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** The instant of a payload time (for display), or undefined when it is unusable. */
export function payloadTimeAt(value: PayloadReminderTime | undefined): string | Date | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' || value instanceof Date ? value : value.at;
}

/** The repeat of a payload time; a plain time or an unknown repeat means once. */
export function payloadTimeRepeat(value: PayloadReminderTime | undefined): ReminderRepeat {
  if (value === undefined || typeof value === 'string' || value instanceof Date) return NO_REPEAT;
  return repeatOf({
    repeatType: value.repeat?.repeatType,
    repeatWeekdays: (value.repeat?.repeatWeekdays ?? []).filter(
      (day): day is number => Number.isInteger(day) && day >= 0 && day <= 6,
    ),
  });
}

/**
 * Requested times of a payload: the `remindTimes` list, else the single `remindAt`.
 * Unusable entries are dropped; each keeps the repeat it was given.
 */
export function revivePayloadTimes(times: unknown, single: unknown): RequestedReminderTime[] {
  const values: unknown[] = Array.isArray(times) ? times : [single];
  return values.flatMap((value: unknown) => {
    if (value instanceof Date || typeof value === 'string') {
      const at = payloadDate(value);
      return at ? [{ at }] : [];
    }
    if (typeof value !== 'object' || value === null) return [];
    const item = value as { at?: unknown; repeat?: Partial<ReminderRepeat> };
    const at = payloadDate(item.at);
    if (!at) return [];
    const repeat = payloadTimeRepeat({ at, repeat: item.repeat });
    return [{ at, ...(repeat.repeatType !== 'none' ? { repeat } : {}) }];
  });
}
