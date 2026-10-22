import type { ICreateTaskRequest, IReminderTargetChannel } from '@zalobot/contracts';
import { dueDateToIso } from '@/shared/lib/local-date-input';
import {
  buildReminderTargetFields,
  emptyReminderTargetDraft,
  type ReminderTargetDraft,
} from '@/modules/reminders/model/reminder-target';
import {
  buildReminderTimes,
  emptyReminderTimeDraft,
  type ReminderTimeDraft,
} from '@/modules/reminders/model/reminder-times';

export interface TaskCreateDraft {
  title: string;
  notes: string;
  /** `date` value; empty = no due date. */
  due: string;
  /** Reminder times; no filled row = no reminder. */
  remindTimes: ReminderTimeDraft[];
  /** Where and who to remind; the chat defaults to the user's own private chat. */
  remindTarget: ReminderTargetDraft;
}

export type TaskCreateError =
  | 'titleRequired'
  | 'remindPastTime'
  | 'remindTooMany'
  | 'remindChannelRequired'
  | 'remindUsersRequired';

export type TaskCreateResult =
  { ok: true; request: ICreateTaskRequest } | { ok: false; error: TaskCreateError };

export const emptyTaskDraft = (): TaskCreateDraft => ({
  title: '',
  notes: '',
  due: '',
  remindTimes: [emptyReminderTimeDraft()],
  remindTarget: emptyReminderTargetDraft(),
});

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
  const times = buildReminderTimes(draft.remindTimes, now);
  if (!times.ok) {
    return { ok: false, error: times.error === 'pastTime' ? 'remindPastTime' : 'remindTooMany' };
  }
  if (times.iso.length === 0) return { ok: true, request };

  const target = buildReminderTargetFields(draft.remindTarget, channels);
  if (!target.ok) {
    return {
      ok: false,
      error: target.error === 'usersRequired' ? 'remindUsersRequired' : 'remindChannelRequired',
    };
  }
  const { chatId, remindUserIds, remindMode } = target.fields;
  return {
    ok: true,
    request: {
      ...request,
      remindTimes: times.iso,
      remindChatId: chatId,
      ...(remindUserIds.length > 0 ? { remindUserIds, remindMode } : {}),
    },
  };
}
