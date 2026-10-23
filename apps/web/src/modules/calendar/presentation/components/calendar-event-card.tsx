'use client';

import type { ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { getEventPhase } from '../../model/calendar-date-utils';
import { SYNC_TONE_CLASS } from '@/shared/ui/google-sync';
import { useCalendarFormat } from './use-calendar-format';

interface CalendarEventCardProps {
  event: ICalendarEventItem;
  now: Date;
  onOpen: (event: ICalendarEventItem) => void;
  /** Hide the description (dense lists such as the desktop side panel). */
  compact?: boolean;
}

const PHASE_BAR: Record<ReturnType<typeof getEventPhase>, string> = {
  ongoing: 'bg-emerald-500 dark:bg-emerald-400',
  upcoming: 'bg-sky-500 dark:bg-sky-400',
  past: 'bg-slate-300 dark:bg-slate-600',
};

/**
 * One event in a list: time range and length, title, place, a short description, who
 * created it and where, and where its Google copy stands. Tapping opens the details sheet.
 */
export function CalendarEventCard({ event, now, onOpen, compact = false }: CalendarEventCardProps) {
  const { t } = useLocale();
  const format = useCalendarFormat();
  const phase = getEventPhase(event, now);
  const duration = format.duration(event);
  const sync = format.sync(event);
  const origin = format.origin(event);

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={`group relative flex w-full gap-2.5 overflow-hidden rounded-[3px] border border-slate-200 bg-white py-2 pr-2.5 pl-3 text-left hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/70 max-[640px]:py-2.5 ${
        phase === 'past' ? 'opacity-70' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[3px] ${PHASE_BAR[phase]}`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-slate-600 tabular-nums dark:text-slate-300">
          <span>{format.range(event)}</span>
          {duration && (
            <span className="font-normal text-slate-400 dark:text-slate-500">· {duration}</span>
          )}
          {phase === 'ongoing' && (
            <span className="rounded-[2px] bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {t('calendar.status.ongoing')}
            </span>
          )}
        </span>
        <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          {event.title}
        </span>
        {event.location && (
          <span className="truncate text-xs text-slate-600 dark:text-slate-300">
            📍 {event.location}
          </span>
        )}
        {!compact && event.description && (
          <span className="line-clamp-2 text-xs whitespace-pre-line text-slate-500 dark:text-slate-400">
            {event.description}
          </span>
        )}
        {(origin || sync) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            {origin && <span className="min-w-0 truncate">{origin}</span>}
            {sync && sync.tone !== 'ok' && (
              <span
                className={`rounded-[2px] border px-1 text-[10px] font-medium ${SYNC_TONE_CLASS[sync.tone]}`}
              >
                {sync.label}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}
