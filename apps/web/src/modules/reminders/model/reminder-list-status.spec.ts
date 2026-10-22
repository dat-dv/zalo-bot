import assert from 'node:assert/strict';
import test from 'node:test';
import { reminderListStatusFrom, writeReminderListStatus } from './reminder-list-status';

void test('the reminders tab defaults to upcoming', () => {
  assert.equal(reminderListStatusFrom(new URLSearchParams('')), 'upcoming');
  assert.equal(reminderListStatusFrom(new URLSearchParams('status=completed')), 'upcoming');
  assert.equal(reminderListStatusFrom(new URLSearchParams('status=done')), 'done');
});

void test('the upcoming tab is left out of the URL, other params stay', () => {
  const params = new URLSearchParams('status=done&x=1');
  assert.equal(writeReminderListStatus(params, 'upcoming').toString(), 'x=1');
  assert.equal(
    writeReminderListStatus(new URLSearchParams('x=1'), 'done').toString(),
    'x=1&status=done',
  );
});
