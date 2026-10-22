import { REMINDER_TIME_LIMITS, type IReminderTime } from '@zalobot/contracts';

/** The dashboard picks reminder times by the minute, so the current minute is not "past". */
export const REMINDER_PAST_TOLERANCE_MS = 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A saved reminder time (a `task_reminder_times` or `reminder_times` row). */
export interface StoredReminderTime {
  id: string;
  remindAt: Date;
  sentAt?: Date | null;
}

export type ReminderTimesError = 'tooMany' | 'pastTime';

/** How to turn the saved times into the requested ones. */
export interface ReminderTimesPlan<T extends StoredReminderTime> {
  keep: T[];
  remove: T[];
  add: Date[];
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

/** Valid, distinct times, earliest first. */
export function normalizeReminderTimes(times: readonly Date[]): Date[] {
  const seen = new Set<number>();
  const result: Date[] = [];
  for (const time of times) {
    const ms = time.getTime();
    if (Number.isNaN(ms) || seen.has(ms)) continue;
    seen.add(ms);
    result.push(new Date(ms));
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Replacing the saved times with the requested ones: a time already saved (same instant) is
 * kept with whether it was sent, so editing other times never re-sends it. New times must be
 * in the future unless `allowPast` (personal reminders: a past time simply goes out at once,
 * as it always did).
 */
export function planReminderTimes<T extends StoredReminderTime>(
  current: readonly T[],
  requested: readonly Date[],
  now: Date = new Date(),
  options: { allowPast?: boolean } = {},
): ReminderTimesPlanResult<T> {
  const wanted = normalizeReminderTimes(requested);
  if (wanted.length > REMINDER_TIME_LIMITS.MAX_TIMES) return { ok: false, error: 'tooMany' };
  const wantedMs = new Set(wanted.map((time) => time.getTime()));
  const currentMs = new Set(current.map((time) => time.remindAt.getTime()));
  const add = wanted.filter((time) => !currentMs.has(time.getTime()));
  const pastLimit = now.getTime() - REMINDER_PAST_TOLERANCE_MS;
  if (!options.allowPast && add.some((time) => time.getTime() < pastLimit)) {
    return { ok: false, error: 'pastTime' };
  }
  return {
    ok: true,
    plan: {
      keep: current.filter((time) => wantedMs.has(time.remindAt.getTime())),
      remove: current.filter((time) => !wantedMs.has(time.remindAt.getTime())),
      add,
    },
  };
}

/** The earliest time not sent yet, or null when every time went out. */
export function nextPendingReminderAt(times: readonly StoredReminderTime[]): Date | null {
  let next: Date | null = null;
  for (const time of times) {
    if (time.sentAt) continue;
    if (!next || time.remindAt.getTime() < next.getTime()) next = time.remindAt;
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

/** The next occurrence of a repeating time after `now` (a missed day is not sent twice). */
export function nextRepeatAt(at: Date, repeat: 'daily' | 'weekly', now: Date): Date {
  const step = repeat === 'daily' ? DAY_MS : 7 * DAY_MS;
  let next = at.getTime() + step;
  while (next <= now.getTime()) next += step;
  return new Date(next);
}

/** DTOs of the times, earliest first. */
export function toReminderTimeItems(times: readonly StoredReminderTime[]): IReminderTime[] {
  return [...times]
    .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
    .map((time) => ({
      id: time.id,
      remindAt: time.remindAt.toISOString(),
      sentAt: time.sentAt?.toISOString(),
    }));
}

/** Request times from an API body: `remindTimes` wins over the single legacy `remindAt`. */
export function requestedReminderTimes(
  remindTimes: readonly string[] | undefined,
  remindAt: string | undefined,
): Date[] | undefined {
  if (remindTimes !== undefined) return remindTimes.map((value) => new Date(value));
  if (remindAt === undefined) return undefined;
  return remindAt ? [new Date(remindAt)] : [];
}
