import type { ICreateTaskRequest, ITaskReminderChannel } from '@zalobot/contracts';
import { dueDateToIso } from '@/shared/lib/local-date-input';

export interface TaskCreateDraft {
  title: string;
  notes: string;
  /** `date` value; empty = no due date. */
  due: string;
  /** `datetime-local` value; empty = no reminder. */
  remindAt: string;
  /** Chosen reminder chat; empty = the user's own private chat, when they have one. */
  remindChatId: string;
}

export type TaskCreateError = 'titleRequired' | 'remindPastTime' | 'remindChannelRequired';

export type TaskCreateResult =
  { ok: true; request: ICreateTaskRequest } | { ok: false; error: TaskCreateError };

export const emptyTaskDraft = (): TaskCreateDraft => ({
  title: '',
  notes: '',
  due: '',
  remindAt: '',
  remindChatId: '',
});

/** The reminder chat used when none is picked: the user's own private chat, if any. */
export function defaultReminderChannelId(
  channels: readonly ITaskReminderChannel[],
): string | undefined {
  return channels.find((channel) => channel.isSelf)?.id;
}

/** A `datetime-local` reminder value as ISO; the current minute still counts as the future. */
export function reminderInputToIso(
  value: string,
  now: Date = new Date(),
): { ok: true; iso: string } | { ok: false } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() < now.getTime() - 60 * 1000) {
    return { ok: false };
  }
  return { ok: true, iso: date.toISOString() };
}

export function buildCreateTaskRequest(
  draft: TaskCreateDraft,
  channels: readonly ITaskReminderChannel[] = [],
  now: Date = new Date(),
): TaskCreateResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'titleRequired' };
  const request: ICreateTaskRequest = {
    title,
    notes: draft.notes.trim() || undefined,
    due: dueDateToIso(draft.due),
  };
  if (!draft.remindAt) return { ok: true, request };

  const remindAt = reminderInputToIso(draft.remindAt, now);
  if (!remindAt.ok) return { ok: false, error: 'remindPastTime' };
  const remindChatId = draft.remindChatId || defaultReminderChannelId(channels);
  if (!remindChatId) return { ok: false, error: 'remindChannelRequired' };
  return { ok: true, request: { ...request, remindAt: remindAt.iso, remindChatId } };
}
