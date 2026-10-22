import type {
  ICalendarEventItem,
  ICalendarEventsQuery,
  ICreateCalendarEventRequest,
} from '@zalobot/contracts';

export type CalendarGridRange = ICalendarEventsQuery;

const DAY_MS = 86_400_000;

function atLocalMidnight(year: number, month: number, day: number): Date {
  return new Date(year, month, day);
}

function parseCalendarDate(value: string): Date | undefined {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return atLocalMidnight(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return atLocalMidnight(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCalendarGridRange(currentMonth: Date): CalendarGridRange {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = atLocalMidnight(year, month, 1);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const start = atLocalMidnight(year, month, 1 - leadingDays);
  const lastDay = atLocalMidnight(year, month + 1, 0);
  const trailingDays = (7 - ((leadingDays + lastDay.getDate()) % 7)) % 7;
  const end = atLocalMidnight(year, month + 1, trailingDays + 1);

  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

/** `days` whole days starting at the local midnight of `from`. */
export function getDaysRange(from: Date, days: number): CalendarGridRange {
  const start = startOfDay(from);
  return { timeMin: start.toISOString(), timeMax: addDays(start, days).toISOString() };
}

export function getEventDateKeys(event: ICalendarEventItem): string[] {
  if (!event.startAt) return [];
  const start = parseCalendarDate(event.startAt);
  if (!start) return [];

  const startIsDateOnly = event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.startAt);
  const end = event.endAt ? parseCalendarDate(event.endAt) : undefined;
  const last = end ? new Date(end) : new Date(start);
  const endsAtMidnight = event.endAt
    ? new Date(event.endAt).getHours() === 0 && new Date(event.endAt).getMinutes() === 0
    : false;

  if (end && (startIsDateOnly || endsAtMidnight)) last.setDate(last.getDate() - 1);
  if (last < start) return [toDateKey(start)];

  const keys: string[] = [];
  for (const date = new Date(start); date <= last; date.setDate(date.getDate() + 1)) {
    keys.push(toDateKey(date));
  }
  return keys;
}

/** Events per local day key, each day sorted by start (all-day first). */
export function groupEventsByDate(
  events: readonly ICalendarEventItem[],
): Map<string, ICalendarEventItem[]> {
  const map = new Map<string, ICalendarEventItem[]>();
  for (const event of events) {
    for (const key of getEventDateKeys(event)) {
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
      return (a.startAt ?? '').localeCompare(b.startAt ?? '');
    });
  }
  return map;
}

/** Local `YYYY-MM-DD` key, the same shape `getEventDateKeys` returns. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function startOfDay(date: Date): Date {
  return atLocalMidnight(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return atLocalMidnight(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The Monday-to-Sunday week containing `anchor`, matching the month grid's week layout. */
export function getWeekDays(anchor: Date): Date[] {
  const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** `HH:mm` (24h) of a timed event; empty for all-day (`YYYY-MM-DD`) or invalid values. */
export function formatEventTime(value: string | undefined, localeTag: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeTag, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export type CalendarEventPhase = 'past' | 'ongoing' | 'upcoming';

export function getEventPhase(event: ICalendarEventItem, now: Date): CalendarEventPhase {
  const start = event.startAt ? new Date(event.startAt).getTime() : NaN;
  const end = event.endAt ? new Date(event.endAt).getTime() : start;
  if (Number.isNaN(start)) return 'upcoming';
  if (end <= now.getTime()) return 'past';
  if (start <= now.getTime()) return 'ongoing';
  return 'upcoming';
}

/** Length of an event split for display: whole days for all-day events, else hours/minutes. */
export function getEventDuration(
  event: ICalendarEventItem,
): { days: number } | { hours: number; minutes: number } | null {
  if (!event.startAt || !event.endAt) return null;
  const ms = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (event.allDay) return { days: Math.max(1, Math.round(ms / DAY_MS)) };
  const totalMinutes = Math.round(ms / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** True when the event's Google copy needs attention (none, failed, or in a lost account). */
export function isEventUnsynced(event: ICalendarEventItem): boolean {
  if (!event.sync) return false;
  return event.sync.status !== 'synced' || !event.sync.isCurrentAccount;
}

/** Create/edit form state. `start`/`end` are `datetime-local` values; all-day uses their dates. */
export interface CalendarEventDraft {
  summary: string;
  location: string;
  description: string;
  allDay: boolean;
  start: string;
  /** Exclusive for timed events; for all-day events the last day (inclusive). */
  end: string;
  reminderMinutes: number[];
}

export const DEFAULT_REMINDER_MINUTES = [60, 30, 10, 0];
export const REMINDER_CHOICES = [0, 10, 30, 60, 1440];

function toLocalInputValue(date: Date): string {
  return `${toDateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** New event on `day`: the next full hour when `day` is today, else 09:00; one hour long. */
export function createEmptyDraft(day: Date, now: Date = new Date()): CalendarEventDraft {
  const start =
    toDateKey(day) === toDateKey(now)
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1)
      : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9);
  return {
    summary: '',
    location: '',
    description: '',
    allDay: false,
    start: toLocalInputValue(start),
    end: toLocalInputValue(new Date(start.getTime() + 3_600_000)),
    reminderMinutes: [...DEFAULT_REMINDER_MINUTES],
  };
}

export function draftFromEvent(event: ICalendarEventItem): CalendarEventDraft {
  const start = event.startAt ? new Date(event.startAt) : new Date();
  const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 3_600_000);
  return {
    summary: event.title,
    location: event.location ?? '',
    description: event.description ?? '',
    allDay: Boolean(event.allDay),
    start: toLocalInputValue(start),
    // All-day ends are exclusive midnights; the form shows the last day.
    end: toLocalInputValue(event.allDay ? addDays(end, -1) : end),
    reminderMinutes: event.reminderMinutes ?? [],
  };
}

/** Request body for a draft, or null when its range is invalid. */
export function draftToRequest(draft: CalendarEventDraft): ICreateCalendarEventRequest | null {
  const summary = draft.summary.trim();
  if (!summary) return null;
  let start: Date;
  let end: Date;
  if (draft.allDay) {
    start = new Date(`${draft.start.slice(0, 10)}T00:00`);
    end = addDays(new Date(`${draft.end.slice(0, 10)}T00:00`), 1);
  } else {
    start = new Date(draft.start);
    end = new Date(draft.end);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return {
    summary,
    location: draft.location.trim(),
    description: draft.description.trim(),
    allDay: draft.allDay,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    reminderMinutes: [...draft.reminderMinutes].sort((a, b) => b - a),
  };
}
