import type { IReminderTargetUser, ReminderTargetMode } from '@zalobot/contracts';
import type { PayloadReminderTime } from '../reminders/reminder-times';

/** Payload of a bot `CREATE_TASK` pending action. */
export interface CreateTaskOptions {
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp (e.g. 2026-08-23T23:59:59.000Z)
  /** ISO time the bot reminds about the task, in the chat it was asked in. */
  remindAt?: string;
  /** Several reminder times, each with its own repeat; wins over `remindAt`. */
  remindTimes?: PayloadReminderTime[];
  /** People tagged in the message (and the sender for "nhắc tôi"), reminded in the group. */
  remindUsers?: IReminderTargetUser[];
  remindMode?: ReminderTargetMode;
  /** Remind again every this many minutes after each time, `nagCount` times. */
  nagEveryMinutes?: number;
  nagCount?: number;
}
