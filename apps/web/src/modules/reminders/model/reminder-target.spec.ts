import assert from 'node:assert/strict';
import test from 'node:test';
import type { IReminderTargetChannel } from '@zalobot/contracts';
import {
  buildReminderTargetFields,
  emptyReminderTargetDraft,
  isTargetChanged,
  reminderTargetDraftFrom,
  toggleTargetUser,
} from './reminder-target';

const SELF: IReminderTargetChannel = { id: '111', name: 'Dat', type: 'user', isSelf: true };
const GROUP: IReminderTargetChannel = { id: 'g1', name: 'Nhà mình', type: 'group' };

test('the chat is the picked one, else the saved one, else the private chat', () => {
  const draft = emptyReminderTargetDraft();
  const fields = (fallback?: string) => {
    const result = buildReminderTargetFields(draft, [SELF, GROUP], fallback);
    return result.ok ? result.fields.chatId : result.error;
  };
  assert.equal(fields(), '111');
  assert.equal(fields('g1'), 'g1');
  const picked = buildReminderTargetFields({ ...draft, chatId: 'g1' }, [SELF, GROUP], '111');
  assert.equal(picked.ok && picked.fields.chatId, 'g1', 'the picked chat wins');
  assert.deepEqual(buildReminderTargetFields(draft, [GROUP]), {
    ok: false,
    error: 'channelRequired',
  });
});

test('people and the private-message mode only apply to a group', () => {
  const group = buildReminderTargetFields({ chatId: 'g1', userIds: ['222'], mode: 'direct' }, [
    SELF,
    GROUP,
  ]);
  assert.deepEqual(group, {
    ok: true,
    fields: { chatId: 'g1', remindUserIds: ['222'], remindMode: 'direct' },
  });
  const own = buildReminderTargetFields({ chatId: '111', userIds: ['222'], mode: 'direct' }, [
    SELF,
    GROUP,
  ]);
  assert.deepEqual(own, {
    ok: true,
    fields: { chatId: '111', remindUserIds: [], remindMode: 'mention' },
  });
});

test('toggleTargetUser adds, removes and stops at 10 people', () => {
  assert.deepEqual(toggleTargetUser(['1'], '2'), ['1', '2']);
  assert.deepEqual(toggleTargetUser(['1', '2'], '1'), ['2']);
  const ten = Array.from({ length: 10 }, (_, i) => String(i));
  assert.deepEqual(toggleTargetUser(ten, 'x'), ten);
});

test('isTargetChanged compares chat, people and mode with the saved target', () => {
  const saved = { chatId: 'g1', users: [{ id: '222', name: 'Trí' }], mode: 'mention' as const };
  const draft = reminderTargetDraftFrom(saved.users, saved.mode);
  assert.equal(isTargetChanged(draft, saved), false);
  assert.equal(isTargetChanged({ ...draft, chatId: 'g1' }, saved), false);
  assert.equal(isTargetChanged({ ...draft, chatId: 'g2' }, saved), true);
  assert.equal(isTargetChanged({ ...draft, userIds: [] }, saved), true);
  assert.equal(isTargetChanged({ ...draft, mode: 'direct' }, saved), true);
});
