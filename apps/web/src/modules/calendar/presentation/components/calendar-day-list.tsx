'use client';

import type { ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { addDays, toDateKey } from '../../model/calendar-date-utils';
import { CalendarEventCard } from './calendar-event-card';
import { useCalendarFormat } from './use-calendar-format';

export interface CalendarDayGroup {
  date: Date;
  events: ICalendarEventItem[];
}

/**
 * Days from `from`, `count` days long: `from` always (even when empty, so the picked day is
 * visible), then only the days that have events.
 */
export function buildDayGroups(
  eventsByDate: ReadonlyMap<string, ICalendarEventItem[]>,
  from: Date,
  count: number,
): CalendarDayGroup[] {
  const groups: CalendarDayGroup[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = addDays(from, offset);
    const events = eventsByDate.get(toDateKey(date)) ?? [];
    if (offset === 0 || events.length > 0) groups.push({ date, events });
  }
  return groups;
}

interface CalendarDayListProps {
  groups: CalendarDayGroup[];
  now: Date;
  onOpenEvent: (event: ICalendarEventItem) => void;
  compact?: boolean;
  /** Shown when no group has any event. */
  emptyMessage?: string;
}

/** Events grouped under day headings ("Hôm nay", "Thứ Sáu, 24 tháng 10", ...). */
export function CalendarDayList({
  groups,
  now,
  onOpenEvent,
  compact = false,
  emptyMessage,
}: CalendarDayListProps) {
  const { t } = useLocale();
  const format = useCalendarFormat();
  const todayKey = toDateKey(now);
  const tomorrowKey = toDateKey(addDays(now, 1));
  const hasEvents = groups.some((group) => group.events.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const key = toDateKey(group.date);
        const relative =
          key === todayKey ? t('common.today') : key === tomorrowKey ? t('calendar.tomorrow') : '';
        return (
          <section
            key={key}
            aria-label={format.dayTitle(group.date)}
            className="flex flex-col gap-1.5"
          >
            <h3 className="m-0 flex items-baseline gap-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {relative && <span className="text-sky-700 dark:text-sky-400">{relative}</span>}
              <span className="font-semibold normal-case">{format.dayTitle(group.date)}</span>
              {group.events.length > 0 && (
                <span className="ml-auto font-medium normal-case tabular-nums">
                  {t('table.rowsCount', { count: group.events.length })}
                </span>
              )}
            </h3>
            {group.events.length === 0 ? (
              <p className="m-0 rounded-[3px] border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                {t('calendar.dayEmpty')}
              </p>
            ) : (
              group.events.map((event) => (
                <CalendarEventCard
                  key={`${key}-${event.id}`}
                  event={event}
                  now={now}
                  onOpen={onOpenEvent}
                  compact={compact}
                />
              ))
            )}
          </section>
        );
      })}
      {!hasEvents && emptyMessage && (
        <p className="m-0 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
