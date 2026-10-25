import { isReminderTargetMode } from '../../reminders/reminder-target';
import { revivePayloadTimes } from '../../reminders/reminder-times';
import { isTextToolType } from './text-tool.definitions';
import { TextToolType } from './text-tool.enum';

/** Keys that change together: an edit that sends any of them replaces the whole group. */
const EDIT_ARG_GROUPS: readonly (readonly string[])[] = [
  ['remindAt', 'remindTimes', 'repeatingTimes'],
  ['nagEveryMinutes', 'nagCount'],
];

function textArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Reminder times of a payload as tool args: once times in `remindTimes`, repeats in `repeatingTimes`. */
function reminderTimeArgs(payload: Record<string, unknown>): Record<string, unknown> {
  const times = revivePayloadTimes(payload.remindTimes, payload.remindAt);
  const once = times.flatMap((time) => (time.repeat ? [] : [time.at.toISOString()]));
  const repeating = times.flatMap((time) =>
    time.repeat
      ? [
          {
            at: time.at.toISOString(),
            repeatType: time.repeat.repeatType,
            ...(time.repeat.repeatWeekdays.length > 0
              ? { repeatWeekdays: [...time.repeat.repeatWeekdays] }
              : {}),
          },
        ]
      : [],
  );
  return {
    ...(once.length > 0 ? { remindTimes: once } : {}),
    ...(repeating.length > 0 ? { repeatingTimes: repeating } : {}),
  };
}

function nagArgs(payload: Record<string, unknown>): Record<string, unknown> {
  const { nagEveryMinutes, nagCount } = payload;
  return typeof nagEveryMinutes === 'number' && typeof nagCount === 'number'
    ? { nagEveryMinutes, nagCount }
    : {};
}

function withoutUndefined(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
}

/**
 * A pending payload as the args of its tool, so an edit shows the LLM what it may send back.
 * People are left out: they come from the tags of the edit message. `undefined` for action
 * types without a mapping, which keep the full re-issue.
 */
export function pendingToolArgs(
  actionType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const remindMode = isReminderTargetMode(payload.remindMode) ? payload.remindMode : undefined;
  switch (isTextToolType(actionType) ? actionType : undefined) {
    case TextToolType.CREATE_TASK:
      return withoutUndefined({
        title: textArg(payload.title),
        due: textArg(payload.due),
        notes: textArg(payload.notes),
        ...reminderTimeArgs(payload),
        ...nagArgs(payload),
        remindMode,
      });
    case TextToolType.SET_REMINDER:
      return withoutUndefined({
        title: textArg(payload.title),
        ...reminderTimeArgs(payload),
        ...nagArgs(payload),
        // A reminder sent to a chat (not privately) was asked for in the group.
        remindInGroup: textArg(payload.chatId) ? true : undefined,
        remindMode,
      });
    default:
      return undefined;
  }
}

/**
 * Args of an edit on top of the card's args: what the edit leaves out (or sends as null) keeps
 * its old value, an explicit empty value ("", [], false) clears it, and sending any key of a
 * group (reminder times, "remind again") replaces the whole group.
 */
export function mergeEditedToolArgs(
  previous: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, unknown> {
  const sent = Object.entries(edited).filter(([, value]) => value !== undefined && value !== null);
  const sentKeys = new Set(sent.map(([key]) => key));
  const replaced = new Set(
    EDIT_ARG_GROUPS.filter((group) => group.some((key) => sentKeys.has(key))).flat(),
  );
  const kept = Object.entries(previous).filter(([key]) => !replaced.has(key));
  return Object.fromEntries([...kept, ...sent]);
}
