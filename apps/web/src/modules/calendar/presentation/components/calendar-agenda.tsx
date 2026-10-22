'use client';

import { useMemo } from 'react';
import type { ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { addDays, getWeekDays, toDateKey } from '../../model/calendar-date-utils';
import { buildDayGroups, CalendarDayList } from './calendar-day-list';
import { DAY_HEADER_KEYS } from './calendar-grid';

interface CalendarAgendaProps {
  eventsByDate: ReadonlyMap<string, ICalendarEventItem[]>;
  selectedDate: Date;
  now: Date;
  loading: boolean;
  onSelectDate: (date: Date) => void;
  onOpenEvent: (event: ICalendarEventItem) => void;
}

/** Days listed after the picked one, so an empty day never leaves an empty screen. */
export const AGENDA_DAYS = 14;

const STRIP_NAV =
  'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-slate-200 !bg-white text-sm text-slate-700 dark:border-slate-700 dark:!bg-slate-900 dark:text-slate-200';

/**
 * Phone view: a Monday-to-Sunday strip (dots mark busy days) to pick a day, then that day
 * and the next two weeks' events as one list grouped by day.
 */
export function CalendarAgenda({
  eventsByDate,
  selectedDate,
  now,
  loading,
  onSelectDate,
  onOpenEvent,
}: CalendarAgendaProps) {
  const { t } = useLocale();
  const week = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const groups = useMemo(
    () => buildDayGroups(eventsByDate, selectedDate, AGENDA_DAYS),
    [eventsByDate, selectedDate],
  );
  const todayKey = toDateKey(now);
  const selectedKey = toDateKey(selectedDate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={STRIP_NAV}
          onClick={() => onSelectDate(addDays(selectedDate, -7))}
          aria-label={t('calendar.agenda.prevWeek')}
        >
          ‹
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
          {week.map((day, index) => {
            const key = toDateKey(day);
            const count = eventsByDate.get(key)?.length ?? 0;
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(day)}
                aria-pressed={isSelected}
                aria-label={`${key}, ${t('table.rowsCount', { count })}`}
                className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[3px] border text-center transition-colors ${
                  isSelected
                    ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-600'
                    : 'border-transparent bg-transparent text-slate-700 dark:text-slate-200'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {t(DAY_HEADER_KEYS[index])}
                </span>
                <span
                  className={`text-[15px] leading-none font-bold tabular-nums ${isToday && !isSelected ? 'text-sky-700 dark:text-sky-400' : ''}`}
                >
                  {day.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: Math.min(count, 3) }, (_, dot) => (
                    <span
                      key={dot}
                      className={`size-1 rounded-full ${isSelected ? 'bg-white' : 'bg-sky-500 dark:bg-sky-400'}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={STRIP_NAV}
          onClick={() => onSelectDate(addDays(selectedDate, 7))}
          aria-label={t('calendar.agenda.nextWeek')}
        >
          ›
        </button>
      </div>

      {loading && groups.every((group) => group.events.length === 0) ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-16 animate-pulse rounded-[3px] bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : (
        <CalendarDayList
          groups={groups}
          now={now}
          onOpenEvent={onOpenEvent}
          emptyMessage={t('calendar.upcoming.empty')}
        />
      )}
    </div>
  );
}
