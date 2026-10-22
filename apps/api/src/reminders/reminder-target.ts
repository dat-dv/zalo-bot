import {
  REMINDER_TARGET_LIMITS,
  REMINDER_TARGET_MODES,
  type IReminderTargetUser,
  type ReminderTargetMode,
} from '@zalobot/contracts';

/**
 * Where a reminder goes (task reminders and personal reminders share it): a chat, the people
 * in that group to remind, and how to reach them. `users` is empty for a private chat.
 */
export interface ReminderTarget {
  chatId: string;
  users: IReminderTargetUser[];
  mode: ReminderTargetMode;
}

/** A Zalo tag inside a message: `pos`/`len` count UTF-16 code units, as `zca-js` expects. */
export interface ReminderMention {
  pos: number;
  uid: string;
  len: number;
}

export interface ReminderMessage {
  text: string;
  mentions: ReminderMention[];
}

export function isReminderTargetMode(value: unknown): value is ReminderTargetMode {
  return REMINDER_TARGET_MODES.some((mode) => mode === value);
}

/** Trimmed, de-duplicated people, at most `MAX_USERS`; names fall back to the id. */
export function normalizeTargetUsers(users: readonly IReminderTargetUser[]): IReminderTargetUser[] {
  const seen = new Set<string>();
  const result: IReminderTargetUser[] = [];
  for (const user of users) {
    const id = user.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name: user.name.trim() || id });
  }
  return result.slice(0, REMINDER_TARGET_LIMITS.MAX_USERS);
}

/** People from untyped JSON (a pending action read back from Redis); invalid entries drop. */
export function parseTargetUsers(value: unknown): IReminderTargetUser[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const users: IReminderTargetUser[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id: unknown = Reflect.get(item, 'id');
    const name: unknown = Reflect.get(item, 'name');
    if (typeof id === 'string' && id)
      users.push({ id, name: typeof name === 'string' ? name : id });
  }
  return normalizeTargetUsers(users);
}

/** Whether a change of target should re-arm a reminder that already went out. */
export function isSameTarget(a: ReminderTarget | null, b: ReminderTarget | null): boolean {
  if (!a || !b) return a === b;
  if (a.chatId !== b.chatId || a.mode !== b.mode || a.users.length !== b.users.length) {
    return false;
  }
  const ids = new Set(a.users.map((user) => user.id));
  return b.users.every((user) => ids.has(user.id));
}

/**
 * `header`, then a line tagging every user (`@A @B`), then `body`. Without users it is just
 * `header` and `body`.
 */
export function buildReminderMessage(
  header: string,
  body: string,
  users: readonly IReminderTargetUser[] = [],
): ReminderMessage {
  if (users.length === 0) return { text: `${header}\n${body}`, mentions: [] };
  const mentions: ReminderMention[] = [];
  let line = '';
  for (const user of users) {
    if (line) line += ' ';
    const tag = `@${user.name}`;
    mentions.push({ pos: header.length + 1 + line.length, uid: user.id, len: tag.length });
    line += tag;
  }
  return { text: `${header}\n${line}\n${body}`, mentions };
}
