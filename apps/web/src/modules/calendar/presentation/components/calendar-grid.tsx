'use client';

import { useMemo } from 'react';
import type { ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  addDays,
  getEventPhase,
  getCalendarGridRange,
  toDateKey,
} from '../../model/calendar-date-utils';
import { useCalendarFormat } from './use-calendar-format';

interface CalendarGridProps {
  eventsByDate: ReadonlyMap<string, ICalendarEventItem[]>;
  currentMonth: Date;
  selectedDate: Date;
  now: Date;
  onSelectDate: (date: Date) => void;
  onOpenEvent: (event: ICalendarEventItem) => void;
}

// Cells keep one height; anything past this collapses into "+N".
const MAX_CHIPS = 3;

export const DAY_HEADER_KEYS = [
  'calendar.day.mon',
  'calendar.day.tue',
  'calendar.day.wed',
  'calendar.day.thu',
  'calendar.day.fri',
  'calendar.day.sat',
  'calendar.day.sun',
] as const;

/**
 * Month grid, Monday first. Desktop cells list up to three events (time + title, all-day
 * ones as filled bars); phone cells are too narrow for text and show up to three dots.
 * Tapping a day selects it; tapping an event opens its details.
 */
export function CalendarGrid({
  eventsByDate,
  currentMonth,
  selectedDate,
  now,
  onSelectDate,
  onOpenEvent,
}: CalendarGridProps) {
  const { t } = useLocale();
  const format = useCalendarFormat();

  const days = useMemo(() => {
    const { timeMin, timeMax } = getCalendarGridRange(currentMonth);
    const list: Date[] = [];
    for (let day = new Date(timeMin); day < new Date(timeMax); day = addDays(day, 1)) {
      list.push(day);
    }
    return list;
  }, [currentMonth]);

  const todayKey = toDateKey(now);
  const selectedKey = toDateKey(selectedDate);

  return (
    <div className="overflow-hidden rounded-[3px] border border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
        {DAY_HEADER_KEYS.map((key) => (
          <div
            key={key}
            className="px-1.5 py-1.5 text-[10.5px] font-semibold tracking-wider text-slate-500 uppercase max-[640px]:text-center dark:text-slate-400"
          >
            {t(key)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" role="grid" aria-label={t('calendar.title')}>
        {days.map((day) => {
          const key = toDateKey(day);
          const events = eventsByDate.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const extra = events.length - MAX_CHIPS;
          return (
            <div
              key={key}
              role="gridcell"
              aria-selected={isSelected}
              className={`relative flex h-[112px] min-w-0 flex-col gap-0.5 border-r border-b border-slate-200 p-1 transition-colors [&:nth-child(7n)]:border-r-0 dark:border-slate-800 max-[1180px]:h-[96px] max-[640px]:h-[52px] max-[640px]:items-center max-[640px]:gap-1 ${
                isSelected
                  ? 'bg-sky-50/80 dark:bg-sky-950/30'
                  : isCurrentMonth
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50/70 dark:bg-slate-950/50'
              }`}
            >
              {/* The whole cell selects the day; event chips sit above it and open the event. */}
              <button
                type="button"
                className="absolute inset-0 cursor-pointer border-0 !bg-transparent p-0 outline-offset-[-2px]"
                onClick={() => onSelectDate(day)}
                aria-label={`${format.dayTitle(day)}, ${t('table.rowsCount', { count: events.length })}`}
                aria-pressed={isSelected}
              />
              <span
                className={`pointer-events-none relative inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] tabular-nums ${
                  isToday
                    ? 'bg-sky-600 font-bold text-white dark:bg-sky-500'
                    : isCurrentMonth
                      ? 'font-medium text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-600'
                } ${isSelected && !isToday ? 'ring-2 ring-sky-500/60' : ''}`}
              >
                {day.getDate()}
              </span>

              {events.length > 0 && (
                <span
                  className="pointer-events-none relative hidden items-center gap-0.5 max-[640px]:flex"
                  aria-hidden="true"
                >
                  {events.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={`size-1.5 rounded-full ${
                        getEventPhase(event, now) === 'past'
                          ? 'bg-slate-300 dark:bg-slate-600'
                          : 'bg-sky-500 dark:bg-sky-400'
                      }`}
                    />
                  ))}
                </span>
              )}

              <div className="relative flex min-h-0 flex-col gap-0.5 max-[640px]:hidden">
                {events.slice(0, MAX_CHIPS).map((event) => {
                  const isPast = getEventPhase(event, now) === 'past';
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onOpenEvent(event)}
                      title={`${format.range(event)} · ${event.title}`}
                      className={`flex min-w-0 cursor-pointer items-center gap-1 rounded-[2px] border px-1 py-px text-left text-[11px] leading-4 transition-colors ${
                        event.allDay
                          ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-600'
                          : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                      } ${isPast ? 'opacity-60' : ''}`}
                    >
                      {!event.allDay && (
                        <>
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400"
                          />
                          <span className="shrink-0 text-[10.5px] font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                            {event.startAt ? format.time(new Date(event.startAt)) : ''}
                          </span>
                        </>
                      )}
                      <span className="truncate">{event.title}</span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDate(day)}
                    className="w-fit cursor-pointer rounded-[2px] border-0 !bg-transparent px-1 text-left text-[10.5px] font-semibold text-slate-500 hover:!bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:!bg-slate-800"
                  >
                    {t('calendar.moreEvents', { count: extra })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
