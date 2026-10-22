'use client';

import { REMINDER_NAG_LIMITS } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { FORM_ERROR_TEXT, FORM_FIELD, FORM_HINT, FORM_LABEL } from '@/shared/ui/form-dialog';
import { nagEveryOptions, type ReminderNagDraft } from '@/modules/reminders/model/reminder-nag';
import { INLINE_EDIT_FIELD } from './reminder-target-fields';

interface ReminderNagFieldsProps {
  value: ReminderNagDraft;
  onChange: (next: ReminderNagDraft) => void;
  /** Tasks stop when done; reminders when marked done. */
  kind: 'task' | 'reminder';
  /** Table-cell layout (inline edit) instead of the dialog layout. */
  compact?: boolean;
  disabled?: boolean;
  /** Reminding again would run into the next repeat of a time. */
  showTooLong?: boolean;
}

const COUNTS = Array.from({ length: REMINDER_NAG_LIMITS.MAX_COUNT }, (_, i) => i + 1);

/**
 * "Remind again every … at most … times", shared by all times of a task or a reminder. Off
 * unless turned on.
 */
export function ReminderNagFields({
  value,
  onChange,
  kind,
  compact = false,
  disabled = false,
  showTooLong = false,
}: ReminderNagFieldsProps) {
  const { t } = useLocale();
  const field = compact ? INLINE_EDIT_FIELD : FORM_FIELD;
  const label = compact ? 'text-[11px] font-medium text-slate-500 dark:text-slate-400' : FORM_LABEL;
  const every = (minutes: number) =>
    minutes % 60 === 0
      ? t('reminderRule.hours', { count: minutes / 60 })
      : t('reminderRule.minutes', { count: minutes });

  return (
    <div className="grid gap-1">
      <label className={`flex cursor-pointer items-center gap-2 ${label}`}>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          disabled={disabled}
        />
        {t('reminderRule.nag')}
      </label>
      {!compact && !value.enabled && (
        <span className={FORM_HINT}>
          {t(kind === 'task' ? 'reminderRule.nagTaskHint' : 'reminderRule.nagReminderHint')}
        </span>
      )}
      {value.enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className={label}>{t('reminderRule.nagEvery')}</span>
            <select
              className={`${field} w-auto`}
              value={value.everyMinutes}
              onChange={(e) => onChange({ ...value, everyMinutes: Number(e.target.value) })}
              disabled={disabled}
            >
              {nagEveryOptions(value.everyMinutes).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {every(minutes)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className={label}>{t('reminderRule.nagCount')}</span>
            <select
              className={`${field} w-auto`}
              value={value.count}
              onChange={(e) => onChange({ ...value, count: Number(e.target.value) })}
              disabled={disabled}
            >
              {COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {showTooLong && <span className={FORM_ERROR_TEXT}>{t('reminderRule.error.nagTooLong')}</span>}
    </div>
  );
}
