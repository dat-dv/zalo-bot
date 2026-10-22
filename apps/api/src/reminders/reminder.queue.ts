/** BullMQ queue that scans and delivers personal reminders. */
export const REMINDERS_QUEUE = 'reminders';

/**
 * One delivery job per reminder time and occurrence: a repeating reminder keeps its time row
 * and only moves `remindAt` forward, so the occurrence is part of the id.
 */
export function reminderJobId(timeId: string, remindAt: Date): string {
  return `reminder-time-${timeId}-${remindAt.getTime()}`;
}
