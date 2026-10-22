import {
  type IReminderTimeInput,
  REMINDER_NAG_EVERY_OPTIONS,
  type ReminderRuleError,
  type TranslationKey,
  validateReminderRule,
} from '@zalobot/contracts';

/**
 * "Remind again" of a task or a reminder: shared by all of its times. Off by default; once
 * turned on, every `everyMinutes` after each reminder, at most `count` times.
 */
export interface ReminderNagDraft {
  enabled: boolean;
  everyMinutes: number;
  count: number;
}

export interface ReminderNagFields {
  nagEveryMinutes: number | null;
  nagCount: number | null;
}

const DEFAULT_EVERY_MINUTES = 15;
const DEFAULT_COUNT = 3;

export const emptyNagDraft = (): ReminderNagDraft => ({
  enabled: false,
  everyMinutes: DEFAULT_EVERY_MINUTES,
  count: DEFAULT_COUNT,
});

/** The draft of a saved rule. */
export function nagDraftFrom(saved: {
  nagEveryMinutes?: number | null;
  nagCount?: number | null;
}): ReminderNagDraft {
  if (!saved.nagEveryMinutes || !saved.nagCount) return emptyNagDraft();
  return { enabled: true, everyMinutes: saved.nagEveryMinutes, count: saved.nagCount };
}

export function buildNagFields(draft: ReminderNagDraft): ReminderNagFields {
  return draft.enabled
    ? { nagEveryMinutes: draft.everyMinutes, nagCount: draft.count }
    : { nagEveryMinutes: null, nagCount: null };
}

export function isNagChanged(
  draft: ReminderNagDraft,
  saved: { nagEveryMinutes?: number | null; nagCount?: number | null },
): boolean {
  const next = buildNagFields(draft);
  return (
    next.nagEveryMinutes !== (saved.nagEveryMinutes ?? null) ||
    next.nagCount !== (saved.nagCount ?? null)
  );
}

/** The "every" choices, keeping a saved value that is not among the defaults. */
export function nagEveryOptions(current: number): number[] {
  const options: number[] = [...REMINDER_NAG_EVERY_OPTIONS];
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

/**
 * Checks reminding again against every time it applies to, as the API does: it must be over
 * before the next occurrence of each repeating time.
 */
export function reminderRuleError(
  times: readonly Pick<IReminderTimeInput, 'repeatType' | 'repeatWeekdays'>[],
  nag: ReminderNagFields,
): ReminderRuleError | null {
  for (const time of [{ repeatType: 'none' as const, repeatWeekdays: [] }, ...times]) {
    const error = validateReminderRule({
      repeatType: time.repeatType ?? 'none',
      repeatWeekdays: time.repeatWeekdays ?? [],
      ...nag,
    });
    if (error) return error;
  }
  return null;
}

export const REMINDER_RULE_ERROR_MESSAGES: Record<ReminderRuleError, TranslationKey> = {
  nagEvery: 'reminderRule.error.nagEvery',
  nagCount: 'reminderRule.error.nagCount',
  nagTooLong: 'reminderRule.error.nagTooLong',
  weekdays: 'reminderRule.error.weekdays',
};
