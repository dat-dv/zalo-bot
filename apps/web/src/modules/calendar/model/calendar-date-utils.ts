import type { ICalendarEventItem } from '@zalobot/contracts';

export interface CalendarGridRange {
  timeMin: string;
  timeMax: string;
}

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

export function getEventDateKeys(event: ICalendarEventItem): string[] {
  if (!event.startAt) return [];
  const start = parseCalendarDate(event.startAt);
  if (!start) return [];

  const startIsDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(event.startAt);
  const end = event.endAt ? parseCalendarDate(event.endAt) : undefined;
  const last = end ? new Date(end) : new Date(start);
  const endsAtMidnight = event.endAt
    ? new Date(event.endAt).getHours() === 0 && new Date(event.endAt).getMinutes() === 0
    : false;

  if (end && (startIsDateOnly || endsAtMidnight)) last.setDate(last.getDate() - 1);
  if (last < start) return [];

  const keys: string[] = [];
  for (const date = new Date(start); date <= last; date.setDate(date.getDate() + 1)) {
    keys.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}
