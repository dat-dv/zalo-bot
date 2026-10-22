import type { Logger } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';
import type { ReminderOccurrence } from '../reminders/reminder-schedule';

/** The part of a BullMQ `Queue` the reminder schedulers use, so tests can pass a plain fake. */
export interface ReminderDeliveryQueue {
  add(name: string, data: unknown, opts?: JobsOptions): Promise<unknown>;
}

/**
 * Payload of a reminder `deliver` job: the claimed time, when the send fired (ISO string) and,
 * for a reminder again, which one of how many.
 */
export interface ReminderDeliveryJobData {
  timeId: string;
  remindAt: string;
  nag?: { index: number; total: number };
}

function isNag(value: unknown): value is { index: number; total: number } {
  if (typeof value !== 'object' || value === null) return false;
  const nag = value as Record<string, unknown>;
  return typeof nag.index === 'number' && typeof nag.total === 'number';
}

export function isReminderDeliveryJobData(value: unknown): value is ReminderDeliveryJobData {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.timeId === 'string' &&
    typeof data.remindAt === 'string' &&
    (data.nag === undefined || isNag(data.nag))
  );
}

export function deliveryJobData(
  timeId: string,
  occurrence: ReminderOccurrence,
): ReminderDeliveryJobData {
  return {
    timeId,
    remindAt: occurrence.at.toISOString(),
    ...(occurrence.nag ? { nag: occurrence.nag } : {}),
  };
}

/** The send a delivery job carries, to give it back when it cannot go out now. */
export function deliveryOccurrence(data: ReminderDeliveryJobData): ReminderOccurrence {
  return { at: new Date(data.remindAt), ...(data.nag ? { nag: data.nag } : {}) };
}

/** `-<ms>` of the send, plus `-nag-<k>` for a reminder again: one job per send. */
export function occurrenceJobSuffix(occurrence: ReminderOccurrence): string {
  const nag = occurrence.nag ? `-nag-${occurrence.nag.index}` : '';
  return `-${occurrence.at.getTime()}${nag}`;
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
