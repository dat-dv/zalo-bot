'use client';

import { useId } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { type CalendarEventDraft, REMINDER_CHOICES } from '../../model/calendar-date-utils';
import { useCalendarFormat } from './use-calendar-format';

const FIELD =
  'h-8 min-h-8 w-full rounded-[3px] border border-slate-300 bg-white px-2 text-[12.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:h-10 max-[640px]:min-h-10 max-[640px]:text-[15px]';
const LABEL = 'text-[11px] font-semibold text-slate-600 dark:text-slate-300';

interface CalendarEventFormProps {
  draft: CalendarEventDraft;
  onChange: (updater: (prev: CalendarEventDraft) => CalendarEventDraft) => void;
  /** Shown under the dates when the end is not after the start. */
  rangeError: boolean;
  /** Off on phones so opening the sheet does not pop the keyboard. */
  autoFocusTitle: boolean;
}

/** Create/edit fields: title, all-day switch, start/end, place, notes and reminders. */
export function CalendarEventForm({
  draft,
  onChange,
  rangeError,
  autoFocusTitle,
}: CalendarEventFormProps) {
  const { t } = useLocale();
  const format = useCalendarFormat();
  const ids = useId();
  const dateType = draft.allDay ? 'date' : 'datetime-local';
  const dateValue = (value: string) => (draft.allDay ? value.slice(0, 10) : value);
  // Switching to all-day keeps the date part; the time part is restored as 09:00.
  const setDate = (field: 'start' | 'end', value: string) =>
    onChange((prev) => ({
      ...prev,
      [field]: prev.allDay ? `${value}T${prev[field].slice(11, 16) || '09:00'}` : value,
    }));

  const toggleReminder = (minutes: number) =>
    onChange((prev) => ({
      ...prev,
      reminderMinutes: prev.reminderMinutes.includes(minutes)
        ? prev.reminderMinutes.filter((value) => value !== minutes)
        : [...prev.reminderMinutes, minutes],
    }));

  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className={LABEL}>{t('calendar.form.title')}</span>
        <input
          type="text"
          className={FIELD}
          value={draft.summary}
          onChange={(e) => onChange((prev) => ({ ...prev, summary: e.target.value }))}
          placeholder={t('calendar.placeholder.title')}
          autoFocus={autoFocusTitle}
          maxLength={500}
          required
        />
      </label>

      <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          className="size-4 accent-sky-600"
          checked={draft.allDay}
          onChange={(e) => onChange((prev) => ({ ...prev, allDay: e.target.checked }))}
        />
        {t('calendar.form.allDay')}
      </label>

      <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
        <label className="grid gap-1" htmlFor={`${ids}-start`}>
          <span className={LABEL}>{t('calendar.form.start')}</span>
          <input
            id={`${ids}-start`}
            type={dateType}
            className={FIELD}
            value={dateValue(draft.start)}
            onChange={(e) => setDate('start', e.target.value)}
          />
        </label>
        <label className="grid gap-1" htmlFor={`${ids}-end`}>
          <span className={LABEL}>{t('calendar.form.end')}</span>
          <input
            id={`${ids}-end`}
            type={dateType}
            className={FIELD}
            value={dateValue(draft.end)}
            onChange={(e) => setDate('end', e.target.value)}
            aria-invalid={rangeError}
            aria-describedby={rangeError ? `${ids}-range` : undefined}
          />
        </label>
      </div>
      {rangeError && (
        <p id={`${ids}-range`} className="-mt-1.5 m-0 text-[11px] text-rose-600 dark:text-rose-400">
          {t('calendar.form.invalidRange')}
        </p>
      )}

      <label className="grid gap-1">
        <span className={LABEL}>{t('calendar.form.location')}</span>
        <input
          type="text"
          className={FIELD}
          value={draft.location}
          onChange={(e) => onChange((prev) => ({ ...prev, location: e.target.value }))}
          placeholder={t('calendar.placeholder.location')}
          maxLength={500}
        />
      </label>

      <label className="grid gap-1">
        <span className={LABEL}>{t('calendar.form.description')}</span>
        <textarea
          className={`${FIELD} h-auto min-h-16 resize-y py-1.5 max-[640px]:h-auto`}
          rows={3}
          value={draft.description}
          onChange={(e) => onChange((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={t('calendar.placeholder.description')}
          maxLength={5000}
        />
      </label>

      <fieldset className="m-0 grid gap-1.5 border-0 p-0">
        <legend className={`${LABEL} mb-1 p-0`}>{t('calendar.reminders.label')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_CHOICES.map((minutes) => {
            const active = draft.reminderMinutes.includes(minutes);
            return (
              <button
                key={minutes}
                type="button"
                aria-pressed={active}
                onClick={() => toggleReminder(minutes)}
                className={`inline-flex h-7 items-center rounded-[3px] border px-2 text-[11.5px] font-medium max-[640px]:h-9 max-[640px]:px-3 ${
                  active ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
                }`}
              >
                {format.reminder(minutes)}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
