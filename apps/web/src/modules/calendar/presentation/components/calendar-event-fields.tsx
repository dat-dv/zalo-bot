'use client';

import { useLocale } from '@/shared/providers/locale-provider';
import { TAP_INPUT } from '@/shared/ui/touch';
import type { CalendarEventDraft } from '../../model/calendar-date-utils';

const FIELD_CLASS = `h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100 ${TAP_INPUT}`;

interface ICalendarEventFieldsProps {
  draft: CalendarEventDraft;
  onDraftChange: (updater: (prev: CalendarEventDraft) => CalendarEventDraft) => void;
  /** Off inside phone sheets so opening the editor does not pop the keyboard. */
  autoFocusTitle: boolean;
}

/** Edit inputs for one event, shared by the month grid's day panel and the phone agenda sheet. */
export function CalendarEventFields({
  draft,
  onDraftChange,
  autoFocusTitle,
}: ICalendarEventFieldsProps) {
  const { t } = useLocale();

  return (
    <>
      <div>
        <input
          type="text"
          className={FIELD_CLASS}
          value={draft.summary}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, summary: e.target.value }))}
          placeholder={t('calendar.placeholder.title')}
          autoFocus={autoFocusTitle}
          required
          aria-label={t('calendar.placeholder.title')}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
        <input
          type="datetime-local"
          className={FIELD_CLASS}
          value={draft.startDateTime}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, startDateTime: e.target.value }))}
          aria-label={t('dashboard.columns.date')}
        />
        <input
          type="datetime-local"
          className={FIELD_CLASS}
          value={draft.endDateTime}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, endDateTime: e.target.value }))}
          aria-label={t('calendar.columns.endAt')}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
        <input
          type="text"
          className={FIELD_CLASS}
          value={draft.location}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, location: e.target.value }))}
          placeholder={t('calendar.placeholder.location')}
          aria-label={t('calendar.placeholder.location')}
        />
        <input
          type="text"
          className={FIELD_CLASS}
          value={draft.description}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={t('calendar.placeholder.description')}
          aria-label={t('calendar.placeholder.description')}
        />
      </div>
    </>
  );
}
