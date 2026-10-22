import type {
  ICreateReminderRequest,
  IReminderTargetChannel,
  ReminderNotifyType,
} from '@zalobot/contracts';
import { toLocalDateTimeInput } from '@/shared/lib/local-date-input';
import {
  buildReminderTargetFields,
  emptyReminderTargetDraft,
  selfChannelId,
  type ReminderTargetDraft,
} from './reminder-target';
import { buildReminderTimes, type ReminderTimeDraft } from './reminder-times';
import {
  buildNagFields,
  emptyNagDraft,
  reminderRuleError,
  type ReminderNagDraft,
} from './reminder-nag';

export const REMINDER_NOTIFY_TYPES: readonly ReminderNotifyType[] = ['text', 'call'];

const DEFAULT_LEAD_MS = 60 * 60 * 1000;

export interface ReminderCreateDraft {
  title: string;
  /** Reminder times, each with its own repeat; at least one filled row. */
  remindTimes: ReminderTimeDraft[];
  notifyType: ReminderNotifyType;
  /** Remind again after each time until marked done; shared by all times. */
  nag: ReminderNagDraft;
  /** Where and who to remind; the chat defaults to the user's own private chat. */
  target: ReminderTargetDraft;
}

export type ReminderCreateError =
  | 'titleRequired'
  | 'remindAtRequired'
  | 'pastTime'
  | 'tooMany'
  | 'channelRequired'
  | 'usersRequired'
  | 'callPrivateOnly'
  | 'nagTooLong';

export type ReminderCreateResult =
  { ok: true; request: ICreateReminderRequest } | { ok: false; error: ReminderCreateError };

/** A new reminder defaults to one hour from now, by message, no repeat, to the private chat. */
export function createReminderDraft(now: Date = new Date()): ReminderCreateDraft {
  return {
    title: '',
    remindTimes: [{ value: toLocalDateTimeInput(new Date(now.getTime() + DEFAULT_LEAD_MS)) }],
    notifyType: 'text',
    nag: emptyNagDraft(),
    target: emptyReminderTargetDraft(),
  };
}

/**
 * `channels` is the list of chats the user may pick; until it is loaded (empty), the target
 * is left to the API default (the user's private chat).
 */
export function buildCreateReminderRequest(
  draft: ReminderCreateDraft,
  now: Date = new Date(),
  channels: readonly IReminderTargetChannel[] = [],
): ReminderCreateResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'titleRequired' };
  // The inputs have minute precision: the current minute still counts as "now", not the past.
  const times = buildReminderTimes(draft.remindTimes, now);
  if (!times.ok) return { ok: false, error: times.error };
  if (times.iso.length === 0) return { ok: false, error: 'remindAtRequired' };
  const nag = buildNagFields(draft.nag);
  if (reminderRuleError(times.times, nag)) return { ok: false, error: 'nagTooLong' };
  const request: ICreateReminderRequest = {
    title,
    remindTimes: times.times,
    notifyType: draft.notifyType,
    ...(nag.nagEveryMinutes && nag.nagCount
      ? { nagEveryMinutes: nag.nagEveryMinutes, nagCount: nag.nagCount }
      : {}),
  };
  if (channels.length === 0) return { ok: true, request };

  const target = buildReminderTargetFields(draft.target, channels);
  if (!target.ok) return { ok: false, error: target.error };
  const { chatId, remindUserIds, remindMode } = target.fields;
  // A call reaches one person: only the user's own private chat.
  if (draft.notifyType === 'call' && chatId !== selfChannelId(channels)) {
    return { ok: false, error: 'callPrivateOnly' };
  }
  return {
    ok: true,
    request: {
      ...request,
      chatId,
      ...(remindUserIds.length > 0 ? { remindUserIds, remindMode } : {}),
    },
  };
}
