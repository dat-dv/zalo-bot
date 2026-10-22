import type { Logger } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';

/** The part of a BullMQ `Queue` the reminder schedulers use, so tests can pass a plain fake. */
export interface ReminderDeliveryQueue {
  add(name: string, data: unknown, opts?: JobsOptions): Promise<unknown>;
}

/** Payload of a reminder `deliver` job: the claimed time and when it fired (ISO string). */
export interface ReminderDeliveryJobData {
  timeId: string;
  remindAt: string;
}

export function isReminderDeliveryJobData(value: unknown): value is ReminderDeliveryJobData {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return typeof data.timeId === 'string' && typeof data.remindAt === 'string';
}

/** Gap between two logged connection errors, so a Redis outage does not flood the log. */
const ERROR_LOG_GAP_MS = 60_000;

/** Logs a queue or worker error at most once a minute. */
export function throttledErrorLogger(logger: Logger, label: string): (err: Error) => void {
  let lastLoggedAt = 0;
  return (err: Error) => {
    const now = Date.now();
    if (now - lastLoggedAt < ERROR_LOG_GAP_MS) return;
    lastLoggedAt = now;
    logger.error(`${label}: ${err.message}`);
  };
}
