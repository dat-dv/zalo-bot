import type { JobsOptions } from 'bullmq';

/** How often the reminder queues look for due reminder times. */
export const REMINDER_SCAN_EVERY_MS = 30_000;

/** Job names used by both reminder queues. */
export const REMINDER_JOBS = {
  SCAN: 'scan',
  DELIVER: 'deliver',
} as const;

/**
 * A reminder time is claimed in Postgres before its delivery is queued, so a failed send is
 * retried here instead of being lost (about 30s, 1m, 2m, 4m apart). Failed jobs are kept a
 * week to look into.
 */
export const REMINDER_DELIVERY_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

/** Scan jobs only matter while they run. */
export const REMINDER_SCAN_JOB_OPTIONS = {
  removeOnComplete: true,
  removeOnFail: { count: 20 },
} as const;
