import {
  REMINDER_TARGET_LIMITS,
  type IReminderTargetChannel,
  type TranslationKey,
  type IReminderTargetUser,
  type ReminderTargetMode,
} from '@zalobot/contracts';

/**
 * The "where and who" of a reminder form, shared by task reminders and reminders. An empty
 * `chatId` means the default chat (the current one when editing, else the private chat).
 */
export interface ReminderTargetDraft {
  chatId: string;
  userIds: string[];
  mode: ReminderTargetMode;
}

export interface ReminderTargetFields {
  chatId?: string;
  remindUserIds: string[];
  remindMode: ReminderTargetMode;
}

export type ReminderTargetError = 'channelRequired' | 'usersRequired';

export type ReminderTargetResult =
  { ok: true; fields: ReminderTargetFields } | { ok: false; error: ReminderTargetError };

/** Message of a target error, for the inline edits that report it in a toast. */
export const REMINDER_TARGET_ERROR_MESSAGES: Record<ReminderTargetError, TranslationKey> = {
  channelRequired: 'reminderTarget.channelRequired',
  usersRequired: 'reminderTarget.usersRequired',
};

export const emptyReminderTargetDraft = (): ReminderTargetDraft => ({
  chatId: '',
  userIds: [],
  mode: 'mention',
});

/** The draft of a saved target; the chat stays empty so "unchanged" is easy to detect. */
export function reminderTargetDraftFrom(
  users: readonly IReminderTargetUser[] | undefined,
  mode: ReminderTargetMode | undefined,
): ReminderTargetDraft {
  return { chatId: '', userIds: (users ?? []).map((user) => user.id), mode: mode ?? 'mention' };
}

/** The user's own private chat, if they have a Zalo account. */
export function selfChannelId(channels: readonly IReminderTargetChannel[]): string | undefined {
  return channels.find((channel) => channel.isSelf)?.id;
}

/** The chat a draft points at: picked, else `fallbackChatId` (the saved one), else the own chat. */
export function draftChatId(
  draft: ReminderTargetDraft,
  channels: readonly IReminderTargetChannel[],
  fallbackChatId?: string,
): string | undefined {
  return draft.chatId || fallbackChatId || selfChannelId(channels);
}

/**
 * Who a private chat reminds: its own person (`self` for the user's own chat). Undefined for a
 * group or an unknown chat.
 */
export function privateRecipient(
  channels: readonly IReminderTargetChannel[],
  chatId: string | undefined,
): { self: boolean; name: string } | undefined {
  const channel = channels.find((item) => item.id === chatId);
  if (!channel || channel.type === 'group') return undefined;
  return { self: !!channel.isSelf, name: channel.name };
}

export function isGroupChannel(
  channels: readonly IReminderTargetChannel[],
  chatId: string | undefined,
): boolean {
  return !!chatId && channels.some((channel) => channel.id === chatId && channel.type === 'group');
}

/** Toggles one person, keeping at most `MAX_USERS`. */
export function toggleTargetUser(userIds: readonly string[], id: string): string[] {
  if (userIds.includes(id)) return userIds.filter((userId) => userId !== id);
  if (userIds.length >= REMINDER_TARGET_LIMITS.MAX_USERS) return [...userIds];
  return [...userIds, id];
}

/**
 * Target fields of a request. Without any chat (no pick, no saved chat, no private chat) the
 * user must pick one. A group needs at least one person to remind; a private chat reminds its
 * own person, so it sends no people and the default mode.
 */
export function buildReminderTargetFields(
  draft: ReminderTargetDraft,
  channels: readonly IReminderTargetChannel[],
  fallbackChatId?: string,
): ReminderTargetResult {
  const chatId = draftChatId(draft, channels, fallbackChatId);
  if (!chatId) return { ok: false, error: 'channelRequired' };
  const isGroup = isGroupChannel(channels, chatId);
  const userIds = isGroup ? draft.userIds.slice(0, REMINDER_TARGET_LIMITS.MAX_USERS) : [];
  if (isGroup && userIds.length === 0) return { ok: false, error: 'usersRequired' };
  return {
    ok: true,
    fields: {
      chatId,
      remindUserIds: userIds,
      remindMode: userIds.length > 0 ? draft.mode : 'mention',
    },
  };
}

/** Whether a draft differs from the saved target (chat, the set of people, or the mode). */
export function isTargetChanged(
  draft: ReminderTargetDraft,
  saved: { chatId?: string; users?: readonly IReminderTargetUser[]; mode?: ReminderTargetMode },
): boolean {
  if (draft.chatId && draft.chatId !== saved.chatId) return true;
  const savedIds = new Set((saved.users ?? []).map((user) => user.id));
  if (draft.userIds.length !== savedIds.size) return true;
  if (draft.userIds.some((id) => !savedIds.has(id))) return true;
  return draft.userIds.length > 0 && draft.mode !== (saved.mode ?? 'mention');
}
