import { REMINDER_TIME_LIMITS, type IReminderTime } from '@zalobot/contracts';
import { toLocalDateTimeInput } from '@/shared/lib/local-date-input';

/**
 * One row of a "reminder times" list (task reminders and reminders). `savedIso` is set for a
 * time loaded from the API: left unchanged, it is sent back as is and never re-checked
 * against the clock, so a time that already went out does not block saving.
 */
export interface ReminderTimeDraft {
  /** `datetime-local` value; empty = an unused row. */
  value: string;
  savedIso?: string;
  sentAt?: string;
}

export type ReminderTimesResult =
  { ok: true; iso: string[] } | { ok: false; error: 'pastTime' | 'tooMany' };

export const emptyReminderTimeDraft = (): ReminderTimeDraft => ({ value: '' });

/** Rows for the saved times (earliest first), or one empty row. */
export function reminderTimeDraftsFrom(
  times: readonly IReminderTime[] | undefined,
): ReminderTimeDraft[] {
  if (!times?.length) return [emptyReminderTimeDraft()];
  return times.map((time) => ({
    value: toLocalDateTimeInput(new Date(time.remindAt)),
    savedIso: time.remindAt,
    sentAt: time.sentAt,
  }));
}

export function hasReminderTime(drafts: readonly ReminderTimeDraft[]): boolean {
  return drafts.some((draft) => !!draft.value);
}

/**
 * The ISO times of the filled rows, earliest first and without duplicates. New or changed
 * times must not be in the past (the current minute still counts, inputs are per minute).
 */
export function buildReminderTimes(
  drafts: readonly ReminderTimeDraft[],
  now: Date = new Date(),
): ReminderTimesResult {
  const iso = new Set<string>();
  for (const draft of drafts) {
    if (!draft.value) continue;
    if (draft.savedIso && draft.value === toLocalDateTimeInput(new Date(draft.savedIso))) {
      iso.add(draft.savedIso);
      continue;
    }
    const date = new Date(draft.value);
    if (Number.isNaN(date.getTime()) || date.getTime() < now.getTime() - 60 * 1000) {
      return { ok: false, error: 'pastTime' };
    }
    iso.add(date.toISOString());
  }
  if (iso.size > REMINDER_TIME_LIMITS.MAX_TIMES) return { ok: false, error: 'tooMany' };
  return { ok: true, iso: [...iso].sort((a, b) => Date.parse(a) - Date.parse(b)) };
}

/** Whether the built times differ from the saved ones (as a set of instants). */
export function isReminderTimesChanged(
  iso: readonly string[],
  saved: readonly IReminderTime[] | undefined,
): boolean {
  const savedMs = new Set((saved ?? []).map((time) => Date.parse(time.remindAt)));
  return iso.length !== savedMs.size || iso.some((value) => !savedMs.has(Date.parse(value)));
}

/** The saved times with the next one not sent pushed `minutes` later (snooze). */
export function snoozeReminderTimes(saved: readonly IReminderTime[], minutes: number): string[] {
  const next = saved.find((time) => !time.sentAt);
  if (!next) return saved.map((time) => time.remindAt);
  const moved = new Date(Date.parse(next.remindAt) + minutes * 60 * 1000).toISOString();
  const rest = saved.filter((time) => time !== next).map((time) => time.remindAt);
  return [...rest, moved].sort((a, b) => Date.parse(a) - Date.parse(b));
}
