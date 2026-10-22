'use client';

import {
  REMINDER_REPEAT_TYPES,
  REMINDER_TIME_LIMITS,
  type IReminderTime,
  type TranslationKey,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { FORM_FIELD, FORM_HINT } from '@/shared/ui/form-dialog';
import {
  emptyReminderTimeDraft,
  type ReminderTimeDraft,
} from '@/modules/reminders/model/reminder-times';
import { INLINE_EDIT_FIELD } from './reminder-target-fields';

interface ReminderTimesFieldProps {
  value: ReminderTimeDraft[];
  onChange: (next: ReminderTimeDraft[]) => void;
  /** Table-cell layout (inline edit) instead of the dialog layout. */
  compact?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel: string;
  onEnter?: () => void;
  onEscape?: () => void;
}

/** Monday first, as Vietnamese calendars show the week (0 = Sunday). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_KEYS: Record<number, TranslationKey> = {
  0: 'weekday.short.0',
  1: 'weekday.short.1',
  2: 'weekday.short.2',
  3: 'weekday.short.3',
  4: 'weekday.short.4',
  5: 'weekday.short.5',
  6: 'weekday.short.6',
};

/**
 * The reminder times of a task or a reminder: one `datetime-local` per time with its own
 * repeat (and the weekdays of a weekly one), a remove button per row and "+ Add a time" (up
 * to `MAX_TIMES`). A time that already went out is marked.
 */
export function ReminderTimesField({
  value,
  onChange,
  compact = false,
  disabled = false,
  invalid = false,
  ariaLabel,
  onEnter,
  onEscape,
}: ReminderTimesFieldProps) {
  const { t } = useLocale();
  const field = compact ? INLINE_EDIT_FIELD : FORM_FIELD;
  const rows = value.length > 0 ? value : [emptyReminderTimeDraft()];
  const full = rows.length >= REMINDER_TIME_LIMITS.MAX_TIMES;
  const update = (index: number, next: ReminderTimeDraft | null) => {
    const copy = [...rows];
    if (next) copy[index] = next;
    else copy.splice(index, 1);
    onChange(copy.length > 0 ? copy : [emptyReminderTimeDraft()]);
  };
  const button = compact
    ? 'inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-slate-300 px-1.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
    : 'inline-flex h-8 min-h-8 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 px-2 text-[12px] text-slate-600 hover:bg-slate-100 disabled:opacity-50 max-[640px]:h-10 max-[640px]:min-h-10 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div className="grid gap-1">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="datetime-local"
              className={`${field} min-w-[150px] flex-1`}
              value={row.value}
              // Editing a saved time makes it a new one, checked against the clock again; it
              // keeps the repeat picked for it.
              onChange={(e) =>
                update(index, {
                  value: e.target.value,
                  repeatType: row.repeatType,
                  repeatWeekdays: row.repeatWeekdays,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEnter?.();
                if (e.key === 'Escape') onEscape?.();
              }}
              aria-label={`${ariaLabel} ${index + 1}`}
              aria-invalid={invalid}
              disabled={disabled}
            />
            <select
              className={`${field} w-auto shrink-0`}
              value={row.repeatType ?? 'none'}
              // A saved time keeps whether it was sent; only its repeat changes.
              onChange={(e) => {
                const repeatType = REMINDER_REPEAT_TYPES.find((type) => type === e.target.value);
                if (repeatType) update(index, { ...row, repeatType, repeatWeekdays: [] });
              }}
              aria-label={`${t('reminderRule.repeat')} ${index + 1}`}
              disabled={disabled}
            >
              {REMINDER_REPEAT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`reminders.repeatType.${type}`)}
                </option>
              ))}
            </select>
            {row.sentAt && (
              <span className={`shrink-0 ${FORM_HINT}`}>{t('reminderTimes.sent')}</span>
            )}
            {(rows.length > 1 || row.value) && (
              <button
                type="button"
                className={button}
                onClick={() => update(index, null)}
                disabled={disabled}
                aria-label={t('reminderTimes.remove')}
                title={t('reminderTimes.remove')}
              >
                ✕
              </button>
            )}
          </div>
          {row.repeatType === 'weekly' && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label={`${t('reminderRule.weekdays')} ${index + 1}`}
            >
              {WEEK_ORDER.map((day) => {
                const picked = row.repeatWeekdays?.includes(day) ?? false;
                return (
                  <button
                    key={day}
                    type="button"
                    className={`${button} ${picked ? 'border-sky-600 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-200' : ''}`}
                    aria-pressed={picked}
                    onClick={() =>
                      update(index, {
                        ...row,
                        repeatWeekdays: picked
                          ? (row.repeatWeekdays ?? []).filter((value) => value !== day)
                          : [...(row.repeatWeekdays ?? []), day],
                      })
                    }
                    disabled={disabled}
                  >
                    {t(WEEKDAY_KEYS[day])}
                  </button>
                );
              })}
              {!compact && !row.repeatWeekdays?.length && (
                <span className={FORM_HINT}>{t('reminderRule.weekdaysHint')}</span>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          onClick={() => onChange([...rows, emptyReminderTimeDraft()])}
          disabled={disabled || full}
        >
          {t('reminderTimes.add')}
        </button>
        {full && (
          <span className={FORM_HINT}>
            {t('reminderTimes.max', { max: REMINDER_TIME_LIMITS.MAX_TIMES })}
          </span>
        )}
      </div>
    </div>
  );
}

interface ReminderTimesSummaryProps {
  /** The next time not sent, else the latest one. */
  remindAt?: string;
  times?: readonly IReminderTime[];
  format: (iso: string) => string;
}

/**
 * "🔔 08:00 23/10 +2": the next reminder time and how many more are still to go out; every
 * time is listed in the tooltip. Muted once every time went out.
 */
export function ReminderTimesSummary({ remindAt, times, format }: ReminderTimesSummaryProps) {
  const { t } = useLocale();
  if (!remindAt) return null;
  const pending = (times ?? []).filter((time) => !time.sentAt);
  const allSent = !!times?.length && pending.length === 0;
  const more = Math.max(pending.length - 1, 0);
  const repeatLabel = (time: IReminderTime) =>
    time.repeatType && time.repeatType !== 'none'
      ? ` (${t(`reminders.repeatType.${time.repeatType}`)})`
      : '';
  const title = (times ?? [])
    .map(
      (time) =>
        `${format(time.remindAt)}${repeatLabel(time)}${time.sentAt ? ` (${t('reminderTimes.sent')})` : ''}`,
    )
    .join('\n');
  // A repeating time is never "sent": it shows 🔁 instead.
  const repeats = (times ?? []).some((time) => time.repeatType && time.repeatType !== 'none');
  return (
    <span
      className={allSent ? 'text-slate-400 dark:text-slate-500' : undefined}
      title={title || undefined}
    >
      🔔 {format(remindAt)}
      {repeats && ' 🔁'}
      {more > 0 && ` ${t('reminderTimes.more', { count: more })}`}
      {allSent && ` · ${t('tasks.remind.sent')}`}
    </span>
  );
}
