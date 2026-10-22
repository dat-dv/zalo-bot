import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupportedLocale } from '@zalobot/contracts';
import type { TaskEntity } from '../database/entities/task.entity';
import { createTargetService } from '../reminders/reminder-target.fixtures.spec';
import type { UsersService } from '../users/users.service';
import type { ZcaMessengerService } from '../zca/zca-messenger.service';
import { TaskReminderSchedulerService } from './task-reminder-scheduler.service';
import type { TasksService } from './tasks.service';

const NOW = new Date('2026-10-22T03:00:00.000Z');

function task(id: string, remindChatId: string, extra: Partial<TaskEntity> = {}): TaskEntity {
  return {
    id,
    title: `Việc ${id}`,
    notes: null,
    dueAt: null,
    status: 'needsAction',
    completedAt: null,
    source: 'zalo',
    createdByUserId: 'u1',
    remindAt: NOW,
    remindChatId,
    remindedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

function setup(options: { connected?: boolean; due: TaskEntity[] }) {
  const marked = new Set<string>();
  const tasks = {
    getDueTaskReminders: () => Promise.resolve(options.due),
    markTaskReminded: (id: string) => {
      if (marked.has(id)) return Promise.resolve(false);
      marked.add(id);
      return Promise.resolve(true);
    },
  };
  const users = { getPreferredLocale: (): Promise<SupportedLocale> => Promise.resolve('vi') };
  const messenger = { isConnected: () => options.connected ?? true };
  const { service: targets, sent } = createTargetService();
  const scheduler = new TaskReminderSchedulerService(
    tasks as unknown as TasksService,
    targets,
    users as unknown as UsersService,
    messenger as unknown as ZcaMessengerService,
  );
  return { scheduler, sent, marked };
}

void test('sends each due reminder once, into its reminder chat', async () => {
  const { scheduler, sent, marked } = setup({ due: [task('a', 'g1'), task('b', '111')] });
  await scheduler.sendDueReminders(NOW);
  assert.deepEqual(
    sent.map((m) => m.chatId),
    ['g1', '111'],
  );
  assert.match(sent[0].text, /📌 Việc a/);
  assert.deepEqual([...marked], ['a', 'b']);

  // A second pass over the same rows (an overlapping tick) sends nothing new.
  await scheduler.sendDueReminders(NOW);
  assert.equal(sent.length, 2);
});

void test('tags the chosen people in the group', async () => {
  const { scheduler, sent } = setup({
    due: [task('a', 'g1', { remindUsers: [{ id: '222', name: 'Trí' }], remindMode: 'mention' })],
  });
  await scheduler.sendDueReminders(NOW);
  assert.deepEqual(sent[0].tagged, ['222']);
  assert.match(sent[0].text, /^⏰ Nhắc việc cần làm\n@Trí\n/);
});

void test('waits while ZCA is logged out, without marking anything', async () => {
  const { scheduler, sent, marked } = setup({ connected: false, due: [task('a', 'g1')] });
  await scheduler.sendDueReminders(NOW);
  assert.equal(sent.length, 0);
  assert.equal(marked.size, 0);
});

void test('skips a group the admin stopped listening to, and marks it', async () => {
  const { scheduler, sent, marked } = setup({ due: [task('a', 'g2')] });
  await scheduler.sendDueReminders(NOW);
  assert.equal(sent.length, 0);
  assert.deepEqual([...marked], ['a']);
});
