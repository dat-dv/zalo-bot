import type { Job, Queue } from 'bullmq';
import {
  REMINDER_JOBS,
  REMINDER_SCAN_EVERY_MS,
  REMINDER_SCAN_JOB_OPTIONS,
} from './queue.constants';
import { type ReminderDeliveryJobData, isReminderDeliveryJobData } from './reminder-queue';

/**
 * Outcome of a delivery: `released` means ZCA was logged out, so the time was given back to
 * the database and the first scan after the next login queues it again.
 */
export type ReminderJobResult = 'sent' | 'failed' | 'skipped' | 'released';

/** What a reminder queue does for each of its jobs. */
export interface ReminderJobHandlers {
  scan(): Promise<void>;
  deliver(data: ReminderDeliveryJobData): Promise<ReminderJobResult>;
}

/**
 * Runs one job of a reminder queue. A failed delivery throws so BullMQ retries it; a scan that
 * throws only fails that run, and the next scheduled scan finds the same rows again.
 */
export async function processReminderJob(
  job: Job<unknown>,
  handlers: ReminderJobHandlers,
): Promise<string | undefined> {
  switch (job.name) {
    case REMINDER_JOBS.SCAN:
      await handlers.scan();
      return undefined;
    case REMINDER_JOBS.DELIVER: {
      if (!isReminderDeliveryJobData(job.data)) {
        throw new Error(`Invalid delivery job ${job.id ?? ''}`);
      }
      const result = await handlers.deliver(job.data);
      if (result === 'failed') {
        throw new Error(`Reminder time ${job.data.timeId} could not be sent`);
      }
      return result;
    }
    default:
      throw new Error(`Unknown reminder job "${job.name}"`);
  }
}

/** Registers the repeating scan; upserting keeps one schedule across restarts and instances. */
export function scheduleReminderScan(queue: Queue): Promise<unknown> {
  return queue.upsertJobScheduler(
    REMINDER_JOBS.SCAN,
    { every: REMINDER_SCAN_EVERY_MS },
    { name: REMINDER_JOBS.SCAN, opts: REMINDER_SCAN_JOB_OPTIONS },
  );
}

/** A job that failed for good: no attempt is left. */
export function isFinalFailure(job: Job<unknown> | undefined): job is Job<unknown> {
  return !!job && job.attemptsMade >= (job.opts.attempts ?? 1);
}
