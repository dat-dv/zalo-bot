import assert from 'node:assert/strict';
import test from 'node:test';
import type { IReminderTargetUser } from '@zalobot/contracts';
import {
  reminderUsersFromContext,
  reminderUsersOrSender,
  requestedTimesFromArgs,
} from './reminder-target-args.util';
import type { TextToolContext } from './text-tool.interface';

function context(chatId: string, taggedUsers: IReminderTargetUser[] = []): TextToolContext {
  return {
    input: { type: 'text', senderId: '111', chatId, displayName: 'Đạt', taggedUsers },
    chatId,
    senderId: '111',
    displayName: 'Đạt',
    text: 'nhắc họp',
  };
}

const TRI = { id: '222', name: 'Trí' };
const SENDER = { id: '111', name: 'Đạt' };

void test('a group message that tags nobody reminds its sender', () => {
  assert.deepEqual(reminderUsersOrSender(context('g1'), false), [SENDER]);
});

void test('a group message reminds the tagged people, plus the sender when asked', () => {
  assert.deepEqual(reminderUsersOrSender(context('g1', [TRI]), false), [TRI]);
  assert.deepEqual(reminderUsersOrSender(context('g1', [TRI]), true), [SENDER, TRI]);
});

void test('a private chat needs nobody: it reminds its own person', () => {
  assert.deepEqual(reminderUsersOrSender(context('111'), true), []);
});

void test('reminderUsersFromContext never guesses: no tags and no "remind me" is nobody', () => {
  assert.deepEqual(reminderUsersFromContext(context('g1'), false), []);
});

// 25/10/2026 10:00 in Vietnam.
const NOW = new Date('2026-10-25T10:00:00+07:00');

void test('repeating times keep their repeat; one-off times come first by instant', () => {
  const times = requestedTimesFromArgs(
    {
      remindAt: '2026-10-26T09:00:00+07:00',
      repeatingTimes: [
        { at: '2027-02-14T08:00:00+07:00', repeatType: 'yearly' },
        { at: '2026-11-02T07:00:00+07:00', repeatType: 'weekly', repeatWeekdays: [1, 9] },
        { at: '2027-03-08T08:00:00+07:00', repeatType: 'hourly' },
      ],
    },
    NOW,
  );
  assert.deepEqual(times, [
    { at: '2026-10-26T09:00:00+07:00' },
    {
      at: '2026-11-02T07:00:00+07:00',
      repeat: { repeatType: 'weekly', repeatWeekdays: [1] },
    },
    { at: '2027-02-14T08:00:00+07:00', repeat: { repeatType: 'yearly', repeatWeekdays: [] } },
  ]);
});

void test('a repeating time already past starts at its next occurrence', () => {
  // "Mỗi dịp 20/10" asked on 25/10: next year's 20/10, not now and not dropped.
  const times = requestedTimesFromArgs(
    { repeatingTimes: [{ at: '2026-10-20T08:00:00+07:00', repeatType: 'yearly' }] },
    NOW,
  );
  assert.deepEqual(times, [
    {
      at: new Date('2027-10-20T08:00:00+07:00').toISOString(),
      repeat: { repeatType: 'yearly', repeatWeekdays: [] },
    },
  ]);
  // A one-off past time is left to the caller as before.
  assert.deepEqual(requestedTimesFromArgs({ remindAt: '2026-10-25T09:00:00+07:00' }, NOW), [
    { at: '2026-10-25T09:00:00+07:00' },
  ]);
});
