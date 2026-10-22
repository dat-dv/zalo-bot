import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  createEmptyDraft,
  draftFromEvent,
  draftToRequest,
  getCalendarGridRange,
  getEventDateKeys,
  getEventDuration,
  getEventPhase,
  getWeekDays,
  groupEventsByDate,
  isEventUnsynced,
  toDateKey,
} from './calendar-date-utils';

void test('requests the complete visible grid instead of only future calendar events', () => {
  const range = getCalendarGridRange(new Date(2026, 7, 1));

  assert.equal(range.timeMin, new Date(2026, 6, 27).toISOString());
  assert.equal(range.timeMax, new Date(2026, 8, 7).toISOString());
});

void test('places a timed multi-day event in each active date and excludes its midnight end', () => {
  assert.deepEqual(
    getEventDateKeys({
      id: 'event-1',
      title: 'Hội nghị',
      startAt: '2026-08-30T09:00:00+07:00',
      endAt: '2026-09-01T00:00:00+07:00',
    }),
    ['2026-08-30', '2026-08-31'],
  );
});

void test('uses Google all-day event end dates as exclusive', () => {
  assert.deepEqual(
    getEventDateKeys({
      id: 'event-2',
      title: 'Nghỉ lễ',
      startAt: '2026-08-31',
      endAt: '2026-09-03',
    }),
    ['2026-08-31', '2026-09-01', '2026-09-02'],
  );
});

void test('builds the Monday-to-Sunday week around a date, across a month boundary', () => {
  const week = getWeekDays(new Date(2026, 8, 2, 15, 30)).map(toDateKey);

  assert.deepEqual(week, [
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
  ]);
  assert.equal(toDateKey(getWeekDays(new Date(2026, 8, 6))[0]), '2026-08-31');
});

void test('moves by whole days at local midnight', () => {
  assert.equal(toDateKey(addDays(new Date(2026, 9, 31, 23, 0), 7)), '2026-11-07');
});

void test('all-day events flagged by the API use their exclusive end like Google dates', () => {
  const start = new Date(2026, 9, 23);
  const end = new Date(2026, 9, 25);
  assert.deepEqual(
    getEventDateKeys({
      id: 'holiday',
      title: 'Nghỉ',
      allDay: true,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    }),
    ['2026-10-23', '2026-10-24'],
  );
});

void test('groupEventsByDate puts all-day events first, then by start time', () => {
  const day = new Date(2026, 9, 23);
  const at = (hours: number) => new Date(2026, 9, 23, hours).toISOString();
  const grouped = groupEventsByDate([
    { id: 'late', title: 'Late', startAt: at(15), endAt: at(16) },
    {
      id: 'all',
      title: 'All day',
      allDay: true,
      startAt: day.toISOString(),
      endAt: addDays(day, 1).toISOString(),
    },
    { id: 'early', title: 'Early', startAt: at(8), endAt: at(9) },
  ]);
  assert.deepEqual(
    grouped.get('2026-10-23')?.map((event) => event.id),
    ['all', 'early', 'late'],
  );
});

void test('draftToRequest turns an inclusive all-day range into an exclusive end', () => {
  const request = draftToRequest({
    summary: ' Du lịch ',
    location: '',
    description: '',
    allDay: true,
    start: '2026-10-23T09:00',
    end: '2026-10-25T09:00',
    reminderMinutes: [0, 60],
  });
  assert.ok(request);
  assert.equal(request.summary, 'Du lịch');
  assert.equal(request.startDateTime, new Date(2026, 9, 23).toISOString());
  assert.equal(request.endDateTime, new Date(2026, 9, 26).toISOString());
  assert.deepEqual(request.reminderMinutes, [60, 0]);
});

void test('draftToRequest rejects an end before the start and an empty title', () => {
  const draft = createEmptyDraft(new Date(2026, 9, 23), new Date(2026, 9, 20, 8));
  assert.equal(draft.start, '2026-10-23T09:00');
  assert.equal(draft.end, '2026-10-23T10:00');
  assert.equal(draftToRequest(draft), null);
  assert.equal(draftToRequest({ ...draft, summary: 'Họp', end: '2026-10-23T08:00' }), null);
  assert.ok(draftToRequest({ ...draft, summary: 'Họp' }));
});

void test('draftFromEvent shows the last day of an all-day event, not its exclusive end', () => {
  const draft = draftFromEvent({
    id: 'e',
    title: 'Nghỉ',
    allDay: true,
    startAt: new Date(2026, 9, 23).toISOString(),
    endAt: new Date(2026, 9, 25).toISOString(),
  });
  assert.equal(draft.end.slice(0, 10), '2026-10-24');
});

void test('event phase, duration and sync helpers', () => {
  const event = {
    id: 'e',
    title: 'Họp',
    startAt: new Date(2026, 9, 23, 9).toISOString(),
    endAt: new Date(2026, 9, 23, 10, 30).toISOString(),
  };
  assert.equal(getEventPhase(event, new Date(2026, 9, 23, 8)), 'upcoming');
  assert.equal(getEventPhase(event, new Date(2026, 9, 23, 9, 30)), 'ongoing');
  assert.equal(getEventPhase(event, new Date(2026, 9, 23, 11)), 'past');
  assert.deepEqual(getEventDuration(event), { hours: 1, minutes: 30 });
  assert.equal(isEventUnsynced(event), false);
  assert.equal(
    isEventUnsynced({ ...event, sync: { status: 'synced', isCurrentAccount: false } }),
    true,
  );
  assert.equal(
    isEventUnsynced({ ...event, sync: { status: 'local', isCurrentAccount: true } }),
    true,
  );
});
