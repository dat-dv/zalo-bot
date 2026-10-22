import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupportedLocale } from '@zalobot/contracts';
import type { JobsOptions } from 'bullmq';
import type { TaskEntity } from '../database/entities/task.entity';
import type { ReminderDeliveryJobData } from '../queue/reminder-queue';
import { createTargetService } from '../reminders/reminder-target.fixtures.spec';
import type { UsersService } from '../users/users.service';
import type { ZcaMessengerService } from '../zca/zca-messenger.service';
import { TaskReminderSchedulerService } from './task-reminder-scheduler.service';
import type { ReminderOccurrence } from '../reminders/reminder-schedule';
import type { DueTaskReminder, TasksService } from './tasks.service';

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

/** A due reminder time of `row`; its id defaults to the task id to keep assertions short. */
function due(row: TaskEntity, id: string = row.id): DueTaskReminder {
  return { id, taskId: row.id, remindAt: NOW, sentAt: null, createdAt: NOW, task: row };
}

interface QueuedJob {
  name: string;
  data: ReminderDeliveryJobData;
  opts?: JobsOptions;
}

function setup(options: {
  connected?: boolean;
  due: DueTaskReminder[];
  queueFails?: boolean;
  failPrivate?: string[];
}) {
  const marked = new Set<string>();
  const released: string[] = [];
  const tasks = {
    getDueTaskReminders: () => Promise.resolve(options.due.filter((time) => !marked.has(time.id))),
    claimTaskReminderTime: (time: DueTaskReminder): Promise<ReminderOccurrence | null> => {
      if (marked.has(time.id)) return Promise.resolve(null);
      marked.add(time.id);
      return Promise.resolve({ at: time.remindAt });
    },
    releaseTaskReminderTime: (id: string) => {
      marked.delete(id);
      released.push(id);
      return Promise.resolve();
    },
    getTaskReminderTime: (id: string) =>
      Promise.resolve(options.due.find((time) => time.id === id) ?? null),
    refreshReminderSummary: () => Promise.resolve(),
  };
  const users = { getPreferredLocale: (): Promise<SupportedLocale> => Promise.resolve('vi') };
  const state = { connected: options.connected ?? true };
  const messenger = { isConnected: () => state.connected };
  const jobs: QueuedJob[] = [];
  const queue = {
    add: (name: string, data: unknown, opts?: JobsOptions) => {
      if (options.queueFails) return Promise.reject(new Error('Redis is down'));
      jobs.push({ name, data: data as ReminderDeliveryJobData, opts });
      return Promise.resolve({});
    },
  };
  const { service: targets, sent } = createTargetService({ failPrivate: options.failPrivate });
  const scheduler = new TaskReminderSchedulerService(
    tasks as unknown as TasksService,
    targets,
    users as unknown as UsersService,
    messenger as unknown as ZcaMessengerService,
    queue,
  );
  /** Runs a scan, then every delivery it queued, like the worker does. */
  const tick = async () => {
    const before = jobs.length;
    await scheduler.scanDueReminders(NOW);
    const results = [];
    for (const job of jobs.slice(before)) results.push(await scheduler.deliverReminder(job.data));
    return results;
  };
  return { scheduler, sent, marked, released, jobs, tick, state };
}

void test('a scan claims each due time and queues one delivery for it', async () => {
  const { jobs, marked, tick } = setup({ due: [due(task('a', 'g1')), due(task('b', '111'))] });
  await tick();
  assert.deepEqual(
    jobs.map((job) => [job.name, job.opts?.jobId, job.data.timeId]),
    [
      ['deliver', `task-time-a-${NOW.getTime()}`, 'a'],
      ['deliver', `task-time-b-${NOW.getTime()}`, 'b'],
    ],
  );
  assert.equal(jobs[0].opts?.attempts, 5);
  assert.deepEqual([...marked], ['a', 'b']);
});

void test('sends each due reminder once, into its reminder chat', async () => {
  const { sent, tick } = setup({ due: [due(task('a', 'g1')), due(task('b', '111'))] });
  await tick();
  assert.deepEqual(
    sent.map((m) => m.chatId),
    ['g1', '111'],
  );
  assert.match(sent[0].text, /📌 Việc a/);

  // A second scan over the same rows (an overlapping tick) queues and sends nothing new.
  await tick();
  assert.equal(sent.length, 2);
});

void test('tags the chosen people in the group', async () => {
  const { sent, tick } = setup({
    due: [
      due(task('a', 'g1', { remindUsers: [{ id: '222', name: 'Trí' }], remindMode: 'mention' })),
    ],
  });
  await tick();
  assert.deepEqual(sent[0].tagged, ['222']);
  assert.match(sent[0].text, /^⏰ Nhắc việc cần làm\n@Trí\n/);
});

void test('waits while ZCA is logged out, without marking anything', async () => {
  const { sent, marked, jobs, tick } = setup({ connected: false, due: [due(task('a', 'g1'))] });
  await tick();
  assert.equal(sent.length, 0);
  assert.equal(marked.size, 0);
  assert.equal(jobs.length, 0);
});

void test('skips a group the admin stopped listening to, and marks it', async () => {
  const { sent, marked, tick } = setup({ due: [due(task('a', 'g2'))] });
  assert.deepEqual(await tick(), ['skipped']);
  assert.equal(sent.length, 0);
  assert.deepEqual([...marked], ['a']);
});

void test('a task with two due times is sent once per time', async () => {
  const row = task('a', 'g1');
  const { sent, tick } = setup({ due: [due(row, 't1'), due(row, 't2')] });
  await tick();
  assert.equal(sent.length, 2);
});

void test('gives the time back when its delivery cannot be queued', async () => {
  const { marked, released, sent, tick } = setup({ due: [due(task('a', 'g1'))], queueFails: true });
  await tick();
  assert.deepEqual(released, ['a']);
  assert.equal(marked.size, 0);
  assert.equal(sent.length, 0);
});

void test('a task done or deleted after the claim is not reminded', async () => {
  const done = due(task('a', 'g1', { status: 'completed' }));
  const deleted = due(task('b', 'g1', { deletedAt: NOW }));
  const { scheduler, sent } = setup({ due: [done, deleted] });
  const data = (timeId: string) => ({ timeId, remindAt: NOW.toISOString() });
  assert.equal(await scheduler.deliverReminder(data('a')), 'skipped');
  assert.equal(await scheduler.deliverReminder(data('b')), 'skipped');
  assert.equal(await scheduler.deliverReminder(data('missing')), 'skipped');
  assert.equal(sent.length, 0);
});

void test('reports a failed send so the queue retries it', async () => {
  const { tick } = setup({ due: [due(task('a', '111'))], failPrivate: ['111'] });
  assert.deepEqual(await tick(), ['failed']);
});

void test('gives the time back when ZCA logs out before the delivery runs', async () => {
  const { scheduler, jobs, marked, released, sent, state } = setup({ due: [due(task('a', 'g1'))] });
  await scheduler.scanDueReminders(NOW);
  state.connected = false;
  assert.equal(await scheduler.deliverReminder(jobs[0].data), 'released');
  assert.deepEqual(released, ['a']);
  assert.equal(marked.size, 0);
  assert.equal(sent.length, 0);
});
