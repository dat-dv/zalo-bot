import type { calendar_v3 } from 'googleapis';
import type { ICalendarEventItem } from '@zalobot/contracts';
import type { CalendarEventEntity } from '../database/entities/calendar-event.entity';
import {
  type RecordOriginLookups,
  creatorDisplayName,
  toGoogleCopySync,
} from '../google/google-copy.util';

/** Event fields shared by a `calendar_events` row and its Google copy. */
export interface CalendarEventFields {
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  timeZone: string;
  reminderMinutes: number[];
}

/** Offset of `timeZone` from UTC at `at`, in ms (positive east of UTC). */
function timeZoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** `YYYY-MM-DD` of `date` as seen in `timeZone`. */
export function toZonedDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Midnight starting `YYYY-MM-DD` in `timeZone`, as an instant. */
export function zonedMidnight(dateString: string, timeZone: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day);
  return new Date(guess - timeZoneOffsetMs(new Date(guess), timeZone));
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Event fields from a Google event, or null when it has no usable start/end. */
export function fromGoogleEvent(
  event: calendar_v3.Schema$Event,
  defaultTimeZone: string,
): CalendarEventFields | null {
  const timeZone = event.start?.timeZone || defaultTimeZone;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startAt = allDay
    ? zonedMidnight(event.start?.date ?? '', timeZone)
    : new Date(event.start?.dateTime ?? '');
  const endAt = allDay
    ? zonedMidnight(event.end?.date ?? event.start?.date ?? '', timeZone)
    : new Date(event.end?.dateTime ?? event.start?.dateTime ?? '');
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return {
    title: cleanText(event.summary) ?? 'Không có tiêu đề',
    description: cleanText(event.description),
    location: cleanText(event.location),
    startAt,
    endAt: endAt > startAt ? endAt : startAt,
    allDay,
    timeZone,
    reminderMinutes: (event.reminders?.overrides ?? [])
      .map((override) => override.minutes)
      .filter((minutes): minutes is number => typeof minutes === 'number')
      .sort((a, b) => b - a),
  };
}

/** Google copy of an event: all-day events use dates, the rest use local date-times. */
export function toGoogleEventBody(
  fields: Omit<CalendarEventFields, 'description' | 'location'> &
    Partial<Pick<CalendarEventFields, 'description' | 'location'>>,
): calendar_v3.Schema$Event {
  const { timeZone } = fields;
  return {
    summary: fields.title,
    description: fields.description ?? undefined,
    location: fields.location ?? undefined,
    start: fields.allDay
      ? { date: toZonedDateString(fields.startAt, timeZone) }
      : { dateTime: fields.startAt.toISOString(), timeZone },
    end: fields.allDay
      ? { date: toZonedDateString(fields.endAt, timeZone) }
      : { dateTime: fields.endAt.toISOString(), timeZone },
    reminders: {
      useDefault: false,
      overrides: fields.reminderMinutes.map((minutes) => ({ method: 'popup', minutes })),
    },
  };
}

/** True when an import from Google would change the stored row. */
export function differsFromRow(row: CalendarEventEntity, fields: CalendarEventFields): boolean {
  return (
    row.title !== fields.title ||
    (row.description ?? null) !== fields.description ||
    (row.location ?? null) !== fields.location ||
    row.startAt.getTime() !== fields.startAt.getTime() ||
    row.endAt.getTime() !== fields.endAt.getTime() ||
    row.allDay !== fields.allDay ||
    JSON.stringify(row.reminderMinutes ?? []) !== JSON.stringify(fields.reminderMinutes)
  );
}

/** Names looked up in one batch per response; see `loadRecordOriginLookups`. */
export type CalendarItemLookups = RecordOriginLookups;

export function toCalendarEventItem(
  row: CalendarEventEntity,
  lookups: CalendarItemLookups,
): ICalendarEventItem {
  const chat = row.sourceChatId ? lookups.chats.get(row.sourceChatId) : undefined;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timeZone: row.timeZone,
    allDay: row.allDay,
    reminderMinutes: row.reminderMinutes ?? [],
    createdByUserId: row.createdByUserId ?? undefined,
    createdByName: creatorDisplayName(row, lookups),
    source: row.source,
    sourceChatName: chat?.name,
    sourceChatType: chat?.type,
    sync: toGoogleCopySync(row, lookups),
    createdAt: row.createdAt?.toISOString(),
  };
}

/** Bot reply label for an event's start, e.g. "T5, 23/10 09:00", "14:30" or "Cả ngày". */
export function formatEventStartVN(
  row: Pick<CalendarEventEntity, 'startAt' | 'allDay' | 'timeZone'>,
  withDate: boolean,
): string {
  const timeZone = row.timeZone || 'Asia/Ho_Chi_Minh';
  if (row.allDay) {
    return withDate
      ? `${row.startAt.toLocaleDateString('vi-VN', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit' })} · Cả ngày`
      : 'Cả ngày';
  }
  return withDate
    ? row.startAt.toLocaleString('vi-VN', {
        timeZone,
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : row.startAt.toLocaleTimeString('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit' });
}
