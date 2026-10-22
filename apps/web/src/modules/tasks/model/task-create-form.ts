import type { ICreateTaskRequest, IReminderTargetChannel } from '@zalobot/contracts';
import { dueDateToIso } from '@/shared/lib/local-date-input';
import {
  buildReminderTargetFields,
  emptyReminderTargetDraft,
  type ReminderTargetDraft,
} from '@/modules/reminders/model/reminder-target';

export interface TaskCreateDraft {
  title: string;
  notes: string;
  /** `date` value; empty = no due date. */
  due: string;
  /** `datetime-local` value; empty = no reminder. */
  remindAt: string;
  /** Where and who to remind; the chat defaults to the user's own private chat. */
  remindTarget: ReminderTargetDraft;
}

export type TaskCreateError = 'titleRequired' | 'remindPastTime' | 'remindChannelRequired';

export type TaskCreateResult =
  { ok: true; request: ICreateTaskRequest } | { ok: false; error: TaskCreateError };

export const emptyTaskDraft = (): TaskCreateDraft => ({
  title: '',
  notes: '',
  due: '',
  remindAt: '',
  remindTarget: emptyReminderTargetDraft(),
});

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
  channels: readonly IReminderTargetChannel[] = [],
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
  const target = buildReminderTargetFields(draft.remindTarget, channels);
  if (!target.ok) return { ok: false, error: 'remindChannelRequired' };
  const { chatId, remindUserIds, remindMode } = target.fields;
  return {
    ok: true,
    request: {
      ...request,
      remindAt: remindAt.iso,
      remindChatId: chatId,
      ...(remindUserIds.length > 0 ? { remindUserIds, remindMode } : {}),
    },
  };
}
