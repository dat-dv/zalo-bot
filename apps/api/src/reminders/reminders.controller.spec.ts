import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { reminderListStatus } from './reminders.controller';

void test('the reminder list defaults to upcoming when no status is sent', () => {
  assert.equal(reminderListStatus(undefined), 'upcoming');
  assert.equal(reminderListStatus(''), 'upcoming');
});

void test('the reminder list accepts upcoming and done only', () => {
  assert.equal(reminderListStatus('upcoming'), 'upcoming');
  assert.equal(reminderListStatus('done'), 'done');
  assert.throws(() => reminderListStatus('completed'), BadRequestException);
  assert.throws(() => reminderListStatus(['done']), BadRequestException);
});
