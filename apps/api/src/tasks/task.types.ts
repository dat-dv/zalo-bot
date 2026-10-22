/** Payload of a bot `CREATE_TASK` pending action. */
export interface CreateTaskOptions {
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp (e.g. 2026-08-23T23:59:59.000Z)
  /** ISO time the bot reminds about the task, in the chat it was asked in. */
  remindAt?: string;
}
