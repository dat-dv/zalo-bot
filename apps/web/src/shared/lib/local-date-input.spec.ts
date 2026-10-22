import assert from 'node:assert/strict';
import test from 'node:test';
import { dueDateToIso, toLocalDateTimeInput } from './local-date-input';

test('a due date is stored at the end of that day (UTC)', () => {
  assert.equal(dueDateToIso('2026-11-01'), '2026-11-01T23:59:59.000Z');
  assert.equal(dueDateToIso(''), undefined);
});

test('formats a date as a datetime-local value in local time', () => {
  assert.equal(toLocalDateTimeInput(new Date(2026, 0, 5, 7, 3, 59)), '2026-01-05T07:03');
  assert.equal(toLocalDateTimeInput(new Date(2026, 11, 31, 23, 59)), '2026-12-31T23:59');
});
