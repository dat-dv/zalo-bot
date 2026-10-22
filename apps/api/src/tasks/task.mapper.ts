import type { tasks_v1 } from 'googleapis';
import type { ITaskListItem, TaskStatus } from '@zalobot/contracts';
import type { TaskEntity } from '../database/entities/task.entity';
import type { GoogleTaskBody } from '../google/google-tasks.service';
import {
  type RecordOriginLookups,
  creatorDisplayName,
  toGoogleCopySync,
} from '../google/google-copy.util';

/** Task fields shared by a `tasks` row and its Google copy. */
export interface TaskFields {
  title: string;
  notes: string | null;
  dueAt: Date | null;
  status: TaskStatus;
  completedAt: Date | null;
}

export const UNTITLED_TASK = 'Không có tiêu đề';

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Google Tasks keeps only the date of `due`, so compare due dates by their UTC day. */
function dueDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Task fields from a Google task, or null for a deleted one. */
export function fromGoogleTask(task: tasks_v1.Schema$Task): TaskFields | null {
  if (task.deleted) return null;
  const status: TaskStatus = task.status === 'completed' ? 'completed' : 'needsAction';
  return {
    title: cleanText(task.title) ?? UNTITLED_TASK,
    notes: cleanText(task.notes),
    dueAt: toDate(task.due),
    status,
    completedAt: status === 'completed' ? (toDate(task.completed) ?? new Date()) : null,
  };
}

export function toGoogleTaskBody(fields: TaskFields): GoogleTaskBody {
  return {
    title: fields.title,
    notes: fields.notes,
    due: fields.dueAt ? fields.dueAt.toISOString() : null,
    status: fields.status,
    completed:
      fields.status === 'completed' ? (fields.completedAt ?? new Date()).toISOString() : null,
  };
}

/** True when an import from Google would change the stored row. */
export function differsFromRow(row: TaskEntity, fields: TaskFields): boolean {
  return (
    row.title !== fields.title ||
    (row.notes ?? null) !== fields.notes ||
    dueDay(row.dueAt) !== dueDay(fields.dueAt) ||
    row.status !== fields.status
  );
}

export function toTaskItem(row: TaskEntity, lookups: RecordOriginLookups): ITaskListItem {
  const chat = row.sourceChatId ? lookups.chats.get(row.sourceChatId) : undefined;
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
    sync: toGoogleCopySync(row, lookups),
    createdAt: row.createdAt?.toISOString(),
  };
}

/** Bot reply suffix for a due date, e.g. " (Hạn: 23/10)", or "" when there is none. */
export function formatTaskDueVN(row: Pick<TaskEntity, 'dueAt'>): string {
  if (!row.dueAt) return '';
  // The due date is a calendar day (Google drops the time), so read it in UTC.
  const pad = (value: number) => String(value).padStart(2, '0');
  return ` (Hạn: ${pad(row.dueAt.getUTCDate())}/${pad(row.dueAt.getUTCMonth() + 1)})`;
}
