import type { IReminderTargetUser, ReminderTargetMode } from '@zalobot/contracts';
import { isReminderTargetMode } from '../../reminders/reminder-target';
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

/** `remindMode` from LLM args; anything else means the default (tag in the group). */
export function reminderModeFromArgs(
  args: Record<string, unknown>,
): ReminderTargetMode | undefined {
  return isReminderTargetMode(args.remindMode) ? args.remindMode : undefined;
}
