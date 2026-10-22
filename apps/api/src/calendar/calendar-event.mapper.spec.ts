import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEventEntity } from '../database/entities/calendar-event.entity';
import {
  type CalendarEventFields,
  differsFromRow,
  formatEventStartVN,
  fromGoogleEvent,
  toCalendarEventItem,
  toGoogleEventBody,
  toZonedDateString,
  zonedMidnight,
} from './calendar-event.mapper';

const TZ = 'Asia/Ho_Chi_Minh';

function row(overrides: Partial<CalendarEventEntity> = {}): CalendarEventEntity {
  return {
    id: '7f9c1a52-1111-4222-8333-944455556666',
    title: 'Họp nhóm',
    description: null,
    location: 'Phòng A',
    startAt: new Date('2026-10-23T02:00:00.000Z'),
    endAt: new Date('2026-10-23T03:30:00.000Z'),
    allDay: false,
    timeZone: TZ,
    reminderMinutes: [30, 10],
    createdByUserId: 'u1',
    createdByName: 'Snapshot',
    source: 'zalo',
    sourceChatId: 'g1',
    googleEventId: 'gev1',
    googleAccountEmail: 'old@gmail.com',
    syncStatus: 'synced',
    syncedAt: new Date('2026-10-22T00:00:00.000Z'),
    deletedAt: null,
    createdAt: new Date('2026-10-21T00:00:00.000Z'),
    updatedAt: new Date('2026-10-21T00:00:00.000Z'),
    ...overrides,
  };
}

void test('zonedMidnight and toZonedDateString round-trip a date in Vietnam time', () => {
  const midnight = zonedMidnight('2026-10-23', TZ);
  assert.equal(midnight.toISOString(), '2026-10-22T17:00:00.000Z');
  assert.equal(toZonedDateString(midnight, TZ), '2026-10-23');
});

void test('fromGoogleEvent maps an all-day event to local midnights (end exclusive)', () => {
  const fields = fromGoogleEvent(
    { summary: ' Nghỉ lễ ', start: { date: '2026-10-23' }, end: { date: '2026-10-25' } },
    TZ,
  );
  assert.ok(fields);
  assert.equal(fields.title, 'Nghỉ lễ');
  assert.equal(fields.allDay, true);
  assert.equal(fields.startAt.toISOString(), '2026-10-22T17:00:00.000Z');
  assert.equal(fields.endAt.toISOString(), '2026-10-24T17:00:00.000Z');
});

void test('fromGoogleEvent keeps reminder overrides and rejects events without a start', () => {
  const fields = fromGoogleEvent(
    {
      start: { dateTime: '2026-10-23T09:00:00+07:00' },
      end: { dateTime: '2026-10-23T10:00:00+07:00' },
      reminders: { useDefault: false, overrides: [{ minutes: 10 }, { minutes: 60 }] },
    },
    TZ,
  );
  assert.ok(fields);
  assert.equal(fields.title, 'Không có tiêu đề');
  assert.deepEqual(fields.reminderMinutes, [60, 10]);
  assert.equal(fromGoogleEvent({ summary: 'x' }, TZ), null);
});

void test('toGoogleEventBody writes dates for all-day events and date-times otherwise', () => {
  const allDay = toGoogleEventBody({
    ...row(),
    allDay: true,
    startAt: zonedMidnight('2026-10-23', TZ),
    endAt: zonedMidnight('2026-10-24', TZ),
  });
  assert.deepEqual(allDay.start, { date: '2026-10-23' });
  assert.deepEqual(allDay.end, { date: '2026-10-24' });

  const timed = toGoogleEventBody(row());
  assert.deepEqual(timed.start, { dateTime: '2026-10-23T02:00:00.000Z', timeZone: TZ });
  assert.deepEqual(timed.reminders?.overrides, [
    { method: 'popup', minutes: 30 },
    { method: 'popup', minutes: 10 },
  ]);
});

void test('differsFromRow ignores unchanged events and catches moved ones', () => {
  const current = row();
  const same: CalendarEventFields = {
    title: current.title,
    description: null,
    location: 'Phòng A',
    startAt: new Date(current.startAt),
    endAt: new Date(current.endAt),
    allDay: false,
    timeZone: TZ,
    reminderMinutes: [30, 10],
  };
  assert.equal(differsFromRow(current, same), false);
  assert.equal(
    differsFromRow(current, { ...same, startAt: new Date('2026-10-23T03:00:00.000Z') }),
    true,
  );
});

void test('toCalendarEventItem resolves names and flags copies in a disconnected account', () => {
  const lookups = {
    userNames: new Map([['u1', 'Đạt']]),
    chats: new Map([['g1', { name: 'Gia đình', type: 'group' as const }]]),
    connectedEmails: new Set(['new@gmail.com']),
  };
  const item = toCalendarEventItem(row(), lookups);
  assert.equal(item.createdByName, 'Đạt');
  assert.equal(item.sourceChatName, 'Gia đình');
  assert.equal(item.sourceChatType, 'group');
  assert.deepEqual(item.sync, {
    status: 'synced',
    accountEmail: 'old@gmail.com',
    isCurrentAccount: false,
    syncedAt: '2026-10-22T00:00:00.000Z',
  });

  const local = toCalendarEventItem(
    row({ googleEventId: null, googleAccountEmail: null, syncStatus: 'local' }),
    lookups,
  );
  assert.equal(local.sync?.isCurrentAccount, true);
  assert.equal(local.sync?.accountEmail, undefined);
});

void test('formatEventStartVN labels all-day and timed events for bot replies', () => {
  assert.equal(formatEventStartVN(row({ allDay: true }), false), 'Cả ngày');
  assert.match(formatEventStartVN(row(), false), /09:00/);
});
