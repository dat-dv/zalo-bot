import {
  REMINDER_TIME_LIMITS,
  type IReminderTime,
  type IReminderTimeInput,
  type ReminderRepeatType,
} from '@zalobot/contracts';
import { toLocalDateTimeInput } from '@/shared/lib/local-date-input';

/**
 * One row of a "reminder times" list (task reminders and reminders), with how that time
 * repeats. `savedIso` is set for a time loaded from the API: left unchanged, it is sent back
 * as is and never re-checked against the clock, so a time that already went out does not
 * block saving.
 */
export interface ReminderTimeDraft {
  /** `datetime-local` value; empty = an unused row. */
  value: string;
  savedIso?: string;
  sentAt?: string;
  /** Absent = once. */
  repeatType?: ReminderRepeatType;
  /** Weekdays of a `weekly` repeat, 0 = Sunday; empty = the weekday of the time. */
  repeatWeekdays?: number[];
}

export type ReminderTimesResult =
  | { ok: true; iso: string[]; times: IReminderTimeInput[] }
  | { ok: false; error: 'pastTime' | 'tooMany' };

export const emptyReminderTimeDraft = (): ReminderTimeDraft => ({ value: '' });

/** The repeat of a row as the API takes it: weekdays sorted, only for `weekly`. */
function repeatInput(
  repeatType: ReminderRepeatType | undefined,
  repeatWeekdays: readonly number[] | undefined,
): Pick<IReminderTimeInput, 'repeatType' | 'repeatWeekdays'> {
  const type = repeatType ?? 'none';
  return {
    repeatType: type,
    repeatWeekdays:
      type === 'weekly' ? [...new Set(repeatWeekdays ?? [])].sort((a, b) => a - b) : [],
  };
}

/** Rows for the saved times (earliest first), or one empty row. */
export function reminderTimeDraftsFrom(
  times: readonly IReminderTime[] | undefined,
): ReminderTimeDraft[] {
  if (!times?.length) return [emptyReminderTimeDraft()];
  return times.map((time) => ({
    value: toLocalDateTimeInput(new Date(time.remindAt)),
    savedIso: time.remindAt,
    sentAt: time.sentAt,
    ...(time.repeatType && time.repeatType !== 'none'
      ? { repeatType: time.repeatType, repeatWeekdays: time.repeatWeekdays ?? [] }
      : {}),
  }));
}

export function hasReminderTime(drafts: readonly ReminderTimeDraft[]): boolean {
  return drafts.some((draft) => !!draft.value);
}

/**
 * The filled rows as times with their repeats, earliest first and without duplicates (the
 * first row of an instant wins). New or changed times must not be in the past (the current
 * minute still counts, inputs are per minute).
 */
export function buildReminderTimes(
  drafts: readonly ReminderTimeDraft[],
  now: Date = new Date(),
): ReminderTimesResult {
  const byIso = new Map<string, IReminderTimeInput>();
  for (const draft of drafts) {
    if (!draft.value) continue;
    let iso: string;
    if (draft.savedIso && draft.value === toLocalDateTimeInput(new Date(draft.savedIso))) {
      iso = draft.savedIso;
    } else {
      const date = new Date(draft.value);
      if (Number.isNaN(date.getTime()) || date.getTime() < now.getTime() - 60 * 1000) {
        return { ok: false, error: 'pastTime' };
      }
      iso = date.toISOString();
    }
    if (!byIso.has(iso)) {
      byIso.set(iso, { remindAt: iso, ...repeatInput(draft.repeatType, draft.repeatWeekdays) });
    }
  }
  if (byIso.size > REMINDER_TIME_LIMITS.MAX_TIMES) return { ok: false, error: 'tooMany' };
  const times = [...byIso.values()].sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt));
  return { ok: true, iso: times.map((time) => time.remindAt), times };
}

function repeatKey(time: Pick<IReminderTimeInput, 'repeatType' | 'repeatWeekdays'>): string {
  const repeat = repeatInput(time.repeatType, time.repeatWeekdays);
  return `${repeat.repeatType}:${(repeat.repeatWeekdays ?? []).join(',')}`;
}

/** Whether the built times differ from the saved ones: other instants, or another repeat. */
export function isReminderTimesChanged(
  times: readonly IReminderTimeInput[],
  saved: readonly IReminderTime[] | undefined,
): boolean {
  const savedByMs = new Map((saved ?? []).map((time) => [Date.parse(time.remindAt), time]));
  if (times.length !== savedByMs.size) return true;
  return times.some((time) => {
    const before = savedByMs.get(Date.parse(time.remindAt));
    return !before || repeatKey(before) !== repeatKey(time);
  });
}

/**
 * The saved times with the next one not sent pushed `minutes` later (snooze). A repeating
 * time keeps repeating: the snooze is an extra one-off time instead.
 */
export function snoozeReminderTimes(
  saved: readonly IReminderTime[],
  minutes: number,
): IReminderTimeInput[] {
  const keep = saved.map((time) => ({
    remindAt: time.remindAt,
    ...repeatInput(time.repeatType, time.repeatWeekdays),
  }));
  const next = saved.find((time) => !time.sentAt);
  if (!next) return keep;
  const moved = {
    remindAt: new Date(Date.parse(next.remindAt) + minutes * 60 * 1000).toISOString(),
    ...repeatInput('none', []),
  };
  const repeating = next.repeatType !== undefined && next.repeatType !== 'none';
  const rest = repeating ? keep : keep.filter((time) => time.remindAt !== next.remindAt);
  return [...rest, moved].sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt));
}
