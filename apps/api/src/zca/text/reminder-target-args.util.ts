import {
  type IReminderTargetUser,
  type ReminderTargetMode,
  isReminderRepeatType,
} from '@zalobot/contracts';
import { isReminderTargetMode } from '../../reminders/reminder-target';
import {
  type NagRuleInput,
  type ReminderRepeat,
  checkReminderRules,
  normalizeRepeat,
  upcomingTime,
} from '../../reminders/reminder-schedule';
import type { TextToolContext } from './text-tool.interface';

/**
 * The people to remind from a bot message: everyone tagged in it, plus the sender when the
 * LLM says they asked to be reminded themselves ("nhắc tôi"). Never guessed from names.
 */
export function reminderUsersFromContext(
  context: TextToolContext,
  includeSender: boolean,
): IReminderTargetUser[] {
  const users = [...(context.input.taggedUsers ?? [])];
  if (includeSender && !users.some((user) => user.id === context.senderId)) {
    users.unshift({ id: context.senderId, name: context.displayName || context.senderId });
  }
  return users;
}

/**
 * The people to remind in this chat: as `reminderUsersFromContext`, but a group always reminds
 * someone, so a group message that tags nobody reminds its sender. A private chat (its id is
 * the sender's uid) needs nobody: it reminds its own person.
 */
export function reminderUsersOrSender(
  context: TextToolContext,
  includeSender: boolean,
): IReminderTargetUser[] {
  const isGroup = context.chatId !== context.senderId;
  if (!isGroup) return [];
  return reminderUsersFromContext(context, includeSender || !context.input.taggedUsers?.length);
}

/**
 * Reminder times from LLM args: the `remindTimes` list, else the single `remindAt`; invalid
 * values are dropped. Empty when the message gave no time.
 */
export function reminderTimesFromArgs(args: Record<string, unknown>): string[] {
  const values: unknown[] = Array.isArray(args.remindTimes) ? args.remindTimes : [args.remindAt];
  const times = values
    .filter((value): value is string => typeof value === 'string' && !!value.trim())
    .map((value) => value.trim())
    .filter((value) => !Number.isNaN(new Date(value).getTime()));
  return [...new Set(times)];
}

/** A requested time from LLM args, with its repeat when it repeats. */
export interface ArgsReminderTime {
  at: string;
  repeat?: ReminderRepeat;
}

/**
 * Reminder times with their repeats: `remindTimes` / `remindAt` are sent once, and each
 * `repeatingTimes` entry `{ at, repeatType, repeatWeekdays? }` adds (or sets the repeat of) its
 * time. A repeating time already past (20/10 asked on 25/10) starts at its next occurrence.
 * Invalid values are dropped; earliest first.
 */
export function requestedTimesFromArgs(
  args: Record<string, unknown>,
  now: Date = new Date(),
): ArgsReminderTime[] {
  const byAt = new Map<number, ArgsReminderTime>();
  for (const at of reminderTimesFromArgs(args)) byAt.set(new Date(at).getTime(), { at });
  const repeating: unknown[] = Array.isArray(args.repeatingTimes) ? args.repeatingTimes : [];
  for (const value of repeating) {
    if (typeof value !== 'object' || value === null) continue;
    const item = value as Record<string, unknown>;
    const at = typeof item.at === 'string' ? item.at.trim() : '';
    const ms = new Date(at).getTime();
    if (!at || Number.isNaN(ms) || !isReminderRepeatType(item.repeatType)) continue;
    const weekdays = Array.isArray(item.repeatWeekdays)
      ? item.repeatWeekdays.filter(
          (day: unknown): day is number =>
            Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6,
        )
      : [];
    const repeat = normalizeRepeat({ repeatType: item.repeatType, repeatWeekdays: weekdays });
    if (repeat.repeatType === 'none') {
      byAt.set(ms, { at });
      continue;
    }
    const start = upcomingTime(new Date(ms), repeat, now).getTime();
    byAt.set(start, { at: start === ms ? at : new Date(start).toISOString(), repeat });
  }
  return [...byAt.entries()].sort(([a], [b]) => a - b).map(([, time]) => time);
}

/**
 * "Remind again" from LLM args: both values or neither. Out-of-range values are dropped
 * rather than failing the whole request; the service checks them against the repeats.
 */
export function nagRuleFromArgs(args: Record<string, unknown>): NagRuleInput {
  const every = args.nagEveryMinutes;
  const count = args.nagCount;
  if (typeof every !== 'number' || typeof count !== 'number') return {};
  const nag = { nagEveryMinutes: Math.round(every), nagCount: Math.round(count) };
  return checkReminderRules([], nag) ? {} : nag;
}

/** `remindMode` from LLM args; anything else means the default (tag in the group). */
export function reminderModeFromArgs(
  args: Record<string, unknown>,
): ReminderTargetMode | undefined {
  return isReminderTargetMode(args.remindMode) ? args.remindMode : undefined;
}
