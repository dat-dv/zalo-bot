import {
  type ITaskListItem,
  type SupportedLocale,
  type TaskStatus,
  translate,
} from '@zalobot/contracts';
import type { TaskEntity } from '../database/entities/task.entity';
import { type RecordOriginLookups, creatorDisplayName } from '../google/google-copy.util';
import {
  type StoredReminderTime,
  nextPendingReminderAt,
  toReminderTimeItems,
} from '../reminders/reminder-times';

/** Editable fields of a `tasks` row. */
export interface TaskFields {
  title: string;
  notes: string | null;
  dueAt: Date | null;
  status: TaskStatus;
  completedAt: Date | null;
}

export const UNTITLED_TASK = 'Không có tiêu đề';

export function toTaskItem(
  row: TaskEntity,
  lookups: RecordOriginLookups,
  times: readonly StoredReminderTime[] = [],
): ITaskListItem {
  const chat = row.sourceChatId ? lookups.chats.get(row.sourceChatId) : undefined;
  const items = toReminderTimeItems(times);
  // The next time not sent, else the latest one (so a fully sent reminder still shows).
  const remindAt = nextPendingReminderAt(times)?.toISOString() ?? items[items.length - 1]?.remindAt;
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    dueAt: row.dueAt?.toISOString(),
    status: row.status,
    updatedAt: row.updatedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdByUserId: row.createdByUserId ?? undefined,
    createdByName: creatorDisplayName(row, lookups),
    source: row.source,
    sourceChatName: chat?.name,
    sourceChatType: chat?.type,
    createdAt: row.createdAt?.toISOString(),
    remindAt,
    remindTimes: items.length > 0 ? items : undefined,
    remindChatId: row.remindChatId ?? undefined,
    remindChatName: row.remindChatId
      ? lookups.chats.get(row.remindChatId)?.name || lookups.userNames.get(row.remindChatId)
      : undefined,
    remindUsers: row.remindChatId ? (row.remindUsers ?? []) : undefined,
    remindMode: row.remindChatId ? (row.remindMode ?? 'mention') : undefined,
    remindedAt: row.remindedAt?.toISOString(),
  };
}

/** Bot reply suffix for a due date, e.g. " (Hạn: 23/10)", or "" when there is none. */
export function formatTaskDueVN(row: Pick<TaskEntity, 'dueAt'>): string {
  const day = formatTaskDueDay(row);
  return day ? ` (Hạn: ${day})` : '';
}

/** A due date as "23/10", or "" when there is none. */
function formatTaskDueDay(row: Pick<TaskEntity, 'dueAt'>): string {
  if (!row.dueAt) return '';
  // A due date is a calendar day stored as the end of that day in UTC, so read it in UTC.
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(row.dueAt.getUTCDate())}/${pad(row.dueAt.getUTCMonth() + 1)}`;
}

const REMINDER_RULE = '━━━━━━━━━━━━━━━━━━━━';
const REMINDER_NOTES_LENGTH = 200;

/** The message the bot posts into the reminder chat when a task's reminder time comes. */
export function formatTaskReminderMessage(
  row: Pick<TaskEntity, 'title' | 'notes' | 'dueAt'>,
  locale: SupportedLocale,
): { header: string; body: string } {
  const notes = row.notes?.trim();
  const due = formatTaskDueDay(row);
  // The tag line of the people to remind goes between the header and the body.
  const body = [
    REMINDER_RULE,
    `📌 ${row.title}`,
    due ? `⏳ ${translate(locale, 'task.reminder.due')}: ${due}` : '',
    notes
      ? `📝 ${notes.length > REMINDER_NOTES_LENGTH ? `${notes.slice(0, REMINDER_NOTES_LENGTH)}…` : notes}`
      : '',
    REMINDER_RULE,
    translate(locale, 'task.reminder.completeHint', { title: row.title }),
  ]
    .filter(Boolean)
    .join('\n');
  return { header: translate(locale, 'task.reminder.header'), body };
}
