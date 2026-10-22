import assert from 'node:assert/strict';
import test from 'node:test';
import type { Job } from 'bullmq';
import { type ReminderJobResult, isFinalFailure, processReminderJob } from './reminder-job';

function job(name: string, data: unknown, attemptsMade = 0, attempts = 5): Job<unknown> {
  return { id: '1', name, data, attemptsMade, opts: { attempts } } as Job<unknown>;
}

function handlers(result: ReminderJobResult) {
  const calls: string[] = [];
  return {
    calls,
    scan: () => {
      calls.push('scan');
      return Promise.resolve();
    },
    deliver: () => {
      calls.push('deliver');
      return Promise.resolve(result);
    },
  };
}

const DATA = { timeId: 't1', remindAt: '2026-10-22T03:00:00.000Z' };

void test('routes scan and deliver jobs to their handler', async () => {
  const h = handlers('sent');
  await processReminderJob(job('scan', undefined), h);
  assert.equal(await processReminderJob(job('deliver', DATA), h), 'sent');
  assert.deepEqual(h.calls, ['scan', 'deliver']);
});

void test('a failed delivery throws so the queue retries it', async () => {
  await assert.rejects(processReminderJob(job('deliver', DATA), handlers('failed')), /t1/);
});

void test('skipped and released deliveries complete the job', async () => {
  assert.equal(await processReminderJob(job('deliver', DATA), handlers('skipped')), 'skipped');
  assert.equal(await processReminderJob(job('deliver', DATA), handlers('released')), 'released');
});

void test('rejects a delivery job without a valid payload, and unknown jobs', async () => {
  await assert.rejects(processReminderJob(job('deliver', { timeId: 1 }), handlers('sent')));
  await assert.rejects(processReminderJob(job('other', DATA), handlers('sent')), /other/);
});

void test('a failure is final only once every attempt was used', () => {
  assert.equal(isFinalFailure(job('deliver', DATA, 4, 5)), false);
  assert.equal(isFinalFailure(job('deliver', DATA, 5, 5)), true);
  assert.equal(isFinalFailure(undefined), false);
});
