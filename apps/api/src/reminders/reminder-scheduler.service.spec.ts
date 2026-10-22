import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupportedLocale } from '@zalobot/contracts';
import type { JobsOptions } from 'bullmq';
import type { ReminderEntity } from '../database/entities/reminder.entity';
import type { ReminderDeliveryJobData } from '../queue/reminder-queue';
import type { UsersService } from '../users/users.service';
import type { ZcaMessengerService } from '../zca/zca-messenger.service';
import { createTargetService } from './reminder-target.fixtures.spec';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import type { DueReminderTime, RemindersService } from './reminders.service';

const NOW = new Date('2026-10-22T03:00:00.000Z');

function reminder(id: string, extra: Partial<ReminderEntity> = {}): ReminderEntity {
  return {
    id,
    userId: '111',
    title: `Nhắc ${id}`,
    remindAt: NOW,
    isTriggered: false,
    status: 'pending',
    snoozeCount: 0,
    notifyType: 'text',
    repeatType: 'none',
    chatId: null,
    remindUsers: [],
    remindMode: 'mention',
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

function due(row: ReminderEntity, id: string = row.id): DueReminderTime {
  return { id, reminderId: row.id, remindAt: NOW, sentAt: null, createdAt: NOW, reminder: row };
}

interface QueuedJob {
  name: string;
  data: ReminderDeliveryJobData;
  opts?: JobsOptions;
}

function setup(options: { connected?: boolean; due: DueReminderTime[]; queueFails?: boolean }) {
  const state = { connected: options.connected ?? true };
  const claimed = new Set<string>();
  const released: Array<{ timeId: string; firedAt: Date }> = [];
  const reminders = {
    getDueReminders: () => Promise.resolve(options.due.filter((time) => !claimed.has(time.id))),
    claimReminderTime: (time: DueReminderTime) => {
      if (claimed.has(time.id)) return Promise.resolve(false);
      claimed.add(time.id);
      return Promise.resolve(true);
    },
    releaseReminderTime: (timeId: string, firedAt: Date) => {
      claimed.delete(timeId);
      released.push({ timeId, firedAt });
      return Promise.resolve();
    },
    getReminderTime: (id: string) =>
      Promise.resolve(options.due.find((time) => time.id === id) ?? null),
    refreshReminderSummary: () => Promise.resolve(),
  };
  const users = { getPreferredLocale: (): Promise<SupportedLocale> => Promise.resolve('vi') };
  const messenger = { isConnected: () => state.connected };
  const jobs: QueuedJob[] = [];
  const queue = {
    add: (name: string, data: unknown, opts?: JobsOptions) => {
      if (options.queueFails) return Promise.reject(new Error('Redis is down'));
      jobs.push({ name, data: data as ReminderDeliveryJobData, opts });
      return Promise.resolve({});
    },
  };
  const { service: targets, sent } = createTargetService();
  const scheduler = new ReminderSchedulerService(
    reminders as unknown as RemindersService,
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
  return { scheduler, sent, claimed, released, jobs, tick, state };
}

void test('a scan claims each due time and queues one delivery per occurrence', async () => {
  const { jobs, tick } = setup({ due: [due(reminder('r1'), 't1')] });
  await tick();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].opts?.jobId, `reminder-time-t1-${NOW.getTime()}`);
  assert.deepEqual(jobs[0].data, { timeId: 't1', remindAt: NOW.toISOString() });
});

void test('sends the reminder to the owner private chat once', async () => {
  const { sent, tick } = setup({ due: [due(reminder('r1'))] });
  assert.deepEqual(await tick(), ['sent']);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, '111');
  assert.match(sent[0].text, /📌 Nội dung: Nhắc r1/);

  await tick();
  assert.equal(sent.length, 1);
});

void test('waits while ZCA is logged out, without claiming anything', async () => {
  const { sent, claimed, tick } = setup({ connected: false, due: [due(reminder('r1'))] });
  await tick();
  assert.equal(sent.length, 0);
  assert.equal(claimed.size, 0);
});

void test('gives the time back when its delivery cannot be queued', async () => {
  const time = due(reminder('r1', { repeatType: 'daily' }));
  const { released, claimed, tick } = setup({ due: [time], queueFails: true });
  await tick();
  assert.deepEqual(released, [{ timeId: 'r1', firedAt: NOW }]);
  assert.equal(claimed.size, 0);
});

void test('gives the time back when ZCA logs out before the delivery runs', async () => {
  const { scheduler, jobs, released, claimed, sent, state } = setup({
    due: [due(reminder('r1', { repeatType: 'daily' }))],
  });
  await scheduler.scanDueReminders(NOW);
  state.connected = false;
  assert.equal(await scheduler.deliverReminder(jobs[0].data), 'released');
  assert.deepEqual(released, [{ timeId: 'r1', firedAt: NOW }]);
  assert.equal(claimed.size, 0);
  assert.equal(sent.length, 0);
});

void test('a reminder deleted after the claim is not sent', async () => {
  const { scheduler, sent } = setup({ due: [] });
  const result = await scheduler.deliverReminder({ timeId: 'gone', remindAt: NOW.toISOString() });
  assert.equal(result, 'skipped');
  assert.equal(sent.length, 0);
});
