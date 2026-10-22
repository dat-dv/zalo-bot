import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  getCalendarGridRange,
  getEventDateKeys,
  getWeekDays,
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
