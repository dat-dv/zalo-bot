import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskEntity } from '../database/entities/task.entity';
import {
  type TaskFields,
  differsFromRow,
  formatTaskDueVN,
  fromGoogleTask,
  toGoogleTaskBody,
} from './task.mapper';

void test('fromGoogleTask maps status, due and completion, and skips deleted tasks', () => {
  assert.deepEqual(
    fromGoogleTask({
      title: '  Đóng tiền điện ',
      notes: '',
      status: 'completed',
      due: '2026-10-20T00:00:00.000Z',
      completed: '2026-10-20T03:00:00.000Z',
    }),
    {
      title: 'Đóng tiền điện',
      notes: null,
      dueAt: new Date('2026-10-20T00:00:00.000Z'),
      status: 'completed',
      completedAt: new Date('2026-10-20T03:00:00.000Z'),
    },
  );
  assert.equal(fromGoogleTask({ title: 'x', deleted: true }), null);
  assert.equal(fromGoogleTask({ title: '' })?.title, 'Không có tiêu đề');
});

void test('toGoogleTaskBody clears completion when a task is re-opened', () => {
  const body = toGoogleTaskBody({
    title: 'Mua sữa',
    notes: null,
    dueAt: null,
    status: 'needsAction',
    completedAt: null,
  });
  assert.equal(body.completed, null);
  assert.equal(body.due, null);
});

void test('differsFromRow compares due dates by day, since Google drops the time', () => {
  const row = {
    title: 'Mua sữa',
    notes: null,
    dueAt: new Date('2026-10-23T23:59:59.000Z'),
    status: 'needsAction',
  } as TaskEntity;
  const fields: TaskFields = {
    title: 'Mua sữa',
    notes: null,
    dueAt: new Date('2026-10-23T00:00:00.000Z'),
    status: 'needsAction',
    completedAt: null,
  };
  assert.equal(differsFromRow(row, fields), false);
  assert.equal(differsFromRow(row, { ...fields, status: 'completed' }), true);
});

void test('formatTaskDueVN reads the due day in UTC', () => {
  assert.equal(formatTaskDueVN({ dueAt: new Date('2026-10-23T00:00:00.000Z') }), ' (Hạn: 23/10)');
  assert.equal(formatTaskDueVN({ dueAt: null }), '');
});
