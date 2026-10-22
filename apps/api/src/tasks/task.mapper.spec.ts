import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskEntity } from '../database/entities/task.entity';
import type { RecordOriginLookups } from '../google/google-copy.util';
import { formatTaskDueVN, toTaskItem } from './task.mapper';

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
