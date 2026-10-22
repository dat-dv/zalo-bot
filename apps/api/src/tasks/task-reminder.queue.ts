import { occurrenceJobSuffix } from '../queue/reminder-queue';
import type { ReminderOccurrence } from '../reminders/reminder-schedule';

/** BullMQ queue that scans and delivers task reminders. */
export const TASK_REMINDERS_QUEUE = 'task-reminders';

/** One delivery job per send: a time can repeat and be reminded again. */
export function taskReminderJobId(timeId: string, occurrence: ReminderOccurrence): string {
  return `task-time-${timeId}${occurrenceJobSuffix(occurrence)}`;
}
