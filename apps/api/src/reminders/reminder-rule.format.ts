import {
  DEFAULT_LOCALE,
  type SupportedLocale,
  type TranslationKey,
  translate,
} from '@zalobot/contracts';
import type { ReminderRepeat } from './reminder-schedule';

const WEEKDAY_KEYS: readonly TranslationKey[] = [
  'weekday.short.0',
  'weekday.short.1',
  'weekday.short.2',
  'weekday.short.3',
  'weekday.short.4',
  'weekday.short.5',
  'weekday.short.6',
];

/** "Hàng ngày", "Hàng tuần (T3, T5)", "Không lặp"… for bot cards and messages. */
export function repeatLabel(
  repeat: ReminderRepeat,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const label = translate(locale, `reminders.repeatType.${repeat.repeatType}`);
  if (repeat.repeatType !== 'weekly' || repeat.repeatWeekdays.length === 0) return label;
  // Monday first, Sunday last, as Vietnamese calendars show the week.
  const days = [...repeat.repeatWeekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return `${label} (${days.map((day) => translate(locale, WEEKDAY_KEYS[day])).join(', ')})`;
}

/** "15 phút", "2 giờ". */
export function everyLabel(minutes: number, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return minutes % 60 === 0
    ? translate(locale, 'reminderRule.hours', { count: minutes / 60 })
    : translate(locale, 'reminderRule.minutes', { count: minutes });
}

/** "nhắc lại mỗi 15 phút ×3", or empty when not reminding again. */
export function nagLabel(
  rule: { nagEveryMinutes?: number | null; nagCount?: number | null },
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  if (!rule.nagEveryMinutes || !rule.nagCount) return '';
  return translate(locale, 'reminderRule.summaryNag', {
    every: everyLabel(rule.nagEveryMinutes, locale),
    count: rule.nagCount,
  });
}

/** The header of a reminder again gets a "Nhắc lại lần 2/3" line, so it reads as a follow-up. */
export function withNagLine(
  header: string,
  nag: { index: number; total: number } | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  if (!nag) return header;
  return `${header}\n${translate(locale, 'reminderRule.nagMessage', nag)}`;
}
