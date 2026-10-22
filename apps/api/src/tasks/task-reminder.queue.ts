/** BullMQ queue that scans and delivers task reminders. */
export const TASK_REMINDERS_QUEUE = 'task-reminders';

/** One delivery job per reminder time; a task reminder time is sent only once. */
export function taskReminderJobId(timeId: string): string {
  return `task-time-${timeId}`;
}
