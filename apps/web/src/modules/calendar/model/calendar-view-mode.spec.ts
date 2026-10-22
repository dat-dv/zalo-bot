import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarViewStorageKey, parseCalendarViewMode } from './calendar-view-mode';

void test('keeps a stored view mode the layout offers', () => {
  assert.equal(parseCalendarViewMode('month', 'phone'), 'month');
  assert.equal(parseCalendarViewMode('agenda', 'phone'), 'agenda');
  assert.equal(parseCalendarViewMode('list', 'desktop'), 'list');
});

void test('drops a view mode from the other layout or an unknown value', () => {
  assert.equal(parseCalendarViewMode('list', 'phone'), null);
  assert.equal(parseCalendarViewMode('agenda', 'desktop'), null);
  assert.equal(parseCalendarViewMode('week', 'desktop'), null);
  assert.equal(parseCalendarViewMode(null, 'phone'), null);
});

void test('stores each layout under its own key', () => {
  assert.equal(calendarViewStorageKey('phone'), 'zalobot:calendar-view:phone');
  assert.equal(calendarViewStorageKey('desktop'), 'zalobot:calendar-view:desktop');
});
