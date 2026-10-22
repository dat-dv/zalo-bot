import type {
  ICreateReminderRequest,
  ReminderNotifyType,
  ReminderRepeatType,
} from '@zalobot/contracts';
import { toLocalDateTimeInput } from '@/shared/lib/local-date-input';

export const REMINDER_NOTIFY_TYPES: readonly ReminderNotifyType[] = ['text', 'call'];
export const REMINDER_REPEAT_TYPES: readonly ReminderRepeatType[] = ['none', 'daily', 'weekly'];

const DEFAULT_LEAD_MS = 60 * 60 * 1000;

export interface ReminderCreateDraft {
  title: string;
  /** `datetime-local` value. */
  remindAt: string;
  notifyType: ReminderNotifyType;
  repeatType: ReminderRepeatType;
}

export type ReminderCreateError = 'titleRequired' | 'remindAtRequired' | 'pastTime';

export type ReminderCreateResult =
  { ok: true; request: ICreateReminderRequest } | { ok: false; error: ReminderCreateError };

/** A new reminder defaults to one hour from now, by message, no repeat. */
export function createReminderDraft(now: Date = new Date()): ReminderCreateDraft {
  return {
    title: '',
    remindAt: toLocalDateTimeInput(new Date(now.getTime() + DEFAULT_LEAD_MS)),
    notifyType: 'text',
    repeatType: 'none',
  };
}

export function buildCreateReminderRequest(
  draft: ReminderCreateDraft,
  now: Date = new Date(),
): ReminderCreateResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'titleRequired' };
  if (!draft.remindAt) return { ok: false, error: 'remindAtRequired' };
  const remindAt = new Date(draft.remindAt);
  if (Number.isNaN(remindAt.getTime())) return { ok: false, error: 'remindAtRequired' };
  // The input has minute precision: the current minute still counts as "now", not the past.
  if (remindAt.getTime() < now.getTime() - 60 * 1000) return { ok: false, error: 'pastTime' };
  return {
    ok: true,
    request: {
      title,
      remindAt: remindAt.toISOString(),
      notifyType: draft.notifyType,
      repeatType: draft.repeatType,
    },
  };
}
