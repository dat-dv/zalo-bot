import { occurrenceJobSuffix } from '../queue/reminder-queue';
import type { ReminderOccurrence } from './reminder-schedule';

/** BullMQ queue that scans and delivers personal reminders. */
export const REMINDERS_QUEUE = 'reminders';

/**
 * One delivery job per send: a repeating time keeps its row and only moves `remindAt`
 * forward, and a time can be reminded again, so the send is part of the id.
 */
export function reminderJobId(timeId: string, occurrence: ReminderOccurrence): string {
  return `reminder-time-${timeId}${occurrenceJobSuffix(occurrence)}`;
}
