import assert from 'node:assert/strict';
import test from 'node:test';
import type { IReminderTargetUser } from '@zalobot/contracts';
import {
  reminderTimesFromArgs,
  reminderUsersForRequest,
  reminderUsersFromContext,
  reminderUsersOrSender,
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

void test('reminderTimesFromArgs keeps remindAt next to the remindTimes list', () => {
  const at = '2027-03-08T02:00:00.000Z';
  const later = '2027-10-20T02:00:00.000Z';
  assert.deepEqual(reminderTimesFromArgs({ remindAt: at, remindTimes: [later] }), [at, later]);
  assert.deepEqual(reminderTimesFromArgs({ remindAt: at, remindTimes: [at, later] }), [at, later]);
});

function editContext(taggedUsers: IReminderTargetUser[] = []): TextToolContext {
  return { ...context('g1', taggedUsers), previousPayload: { remindUsers: [TRI] } };
}

void test('an edit that tags nobody keeps the people of the card it replaces', () => {
  assert.deepEqual(reminderUsersForRequest(editContext(), false), [TRI]);
});

void test('an edit that tags people, or asks to remind the sender, sets the people anew', () => {
  const NAM = { id: '333', name: 'Nam' };
  assert.deepEqual(reminderUsersForRequest(editContext([NAM]), false), [NAM]);
  assert.deepEqual(reminderUsersForRequest(editContext(), true), [SENDER]);
});

void test('a new request reminds as reminderUsersOrSender does', () => {
  assert.deepEqual(reminderUsersForRequest(context('g1'), false), [SENDER]);
  assert.deepEqual(reminderUsersForRequest(context('g1', [TRI]), false), [TRI]);
});
