import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskEntity } from '../database/entities/task.entity';
import type { RecordOriginLookups } from '../google/google-copy.util';
import { formatTaskDueVN, formatTaskReminderMessage, toTaskItem } from './task.mapper';

void test('toTaskItem resolves the creator and source chat names, with no Google sync info', () => {
  const lookups: RecordOriginLookups = {
    userNames: new Map([['u1', 'Đạt']]),
    chats: new Map([['g1', { name: 'Nhà mình', type: 'group' }]]),
    connectedEmails: new Set(),
  };
  const row: TaskEntity = {
    id: 't1',
    title: 'Mua sữa',
    notes: null,
    dueAt: new Date('2026-10-23T23:59:59.000Z'),
    status: 'needsAction',
    completedAt: null,
    createdByUserId: 'u1',
    createdByName: 'Old name',
    source: 'zalo',
    sourceChatId: 'g1',
    createdAt: new Date('2026-10-22T01:00:00.000Z'),
    updatedAt: new Date('2026-10-22T02:00:00.000Z'),
  };
  const item = toTaskItem(row, lookups);
  assert.equal(item.createdByName, 'Đạt');
  assert.equal(item.sourceChatName, 'Nhà mình');
  assert.equal(item.sourceChatType, 'group');
  assert.equal(item.notes, undefined);
  assert.equal(item.dueAt, '2026-10-23T23:59:59.000Z');
  assert.equal('sync' in item, false);
});

void test('formatTaskDueVN reads the due day in UTC', () => {
  assert.equal(formatTaskDueVN({ dueAt: new Date('2026-10-23T00:00:00.000Z') }), ' (Hạn: 23/10)');
  assert.equal(formatTaskDueVN({ dueAt: null }), '');
});

void test('toTaskItem names the reminder chat from threads, else from users', () => {
  const lookups: RecordOriginLookups = {
    userNames: new Map([['111', 'Đạt']]),
    chats: new Map([['g1', { name: 'Nhà mình', type: 'group' }]]),
    connectedEmails: new Set(),
  };
  const base = {
    id: 't1',
    title: 'Họp',
    status: 'needsAction',
    source: 'dashboard',
    remindAt: new Date('2026-10-23T01:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies Partial<TaskEntity>;
  const inGroup = toTaskItem({ ...base, remindChatId: 'g1' }, lookups);
  assert.equal(inGroup.remindChatName, 'Nhà mình');
  assert.equal(inGroup.remindAt, '2026-10-23T01:00:00.000Z');
  const inPrivate = toTaskItem({ ...base, remindChatId: '111' }, lookups);
  assert.equal(inPrivate.remindChatName, 'Đạt');
});

void test('formatTaskReminderMessage shows title, due day and notes', () => {
  const { header, body } = formatTaskReminderMessage(
    { title: 'Nộp báo cáo', notes: 'Quý 3', dueAt: new Date('2026-10-23T23:59:59.000Z') },
    'vi',
  );
  assert.equal(header, '⏰ Nhắc việc cần làm');
  assert.match(body, /📌 Nộp báo cáo/);
  assert.match(body, /⏳ Hạn: 23\/10/);
  assert.match(body, /📝 Quý 3/);
  assert.match(body, /Nhắn bot "xong Nộp báo cáo"/);
  const bare = formatTaskReminderMessage({ title: 'Họp', notes: null, dueAt: null }, 'en');
  assert.doesNotMatch(bare.body, /⏳|📝/);
  assert.match(bare.header, /Task reminder/);
});
