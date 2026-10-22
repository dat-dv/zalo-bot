import assert from 'node:assert/strict';
import test from 'node:test';
import type { IReminderTargetUser } from '@zalobot/contracts';
import { reminderUsersFromContext, reminderUsersOrSender } from './reminder-target-args.util';
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
