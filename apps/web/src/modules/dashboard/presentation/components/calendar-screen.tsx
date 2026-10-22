'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localeTag, type ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useIsPhone } from '@/shared/hooks/use-media-query';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import { TOAST_POSITION } from '@/shared/ui/touch';
import { calendarQueryKeys, useCalendarEventsQuery } from '@/modules/calendar/api/calendar-query';
import {
  addDays,
  getCalendarGridRange,
  getDaysRange,
  getWeekDays,
  groupEventsByDate,
  isEventUnsynced,
  startOfDay,
  toDateKey,
} from '@/modules/calendar/model/calendar-date-utils';
import { CalendarAgenda, AGENDA_DAYS } from '@/modules/calendar/view/calendar-agenda';
import { CalendarGrid } from '@/modules/calendar/view/calendar-grid';
import { buildDayGroups, CalendarDayList } from '@/modules/calendar/view/calendar-day-list';
import {
  CalendarEventSheet,
  type CalendarSheetTarget,
} from '@/modules/calendar/view/calendar-event-sheet';
import { CalendarSummaryStrip } from '@/modules/calendar/view/calendar-summary-strip';
import { useStoredCalendarViewMode } from '@/modules/calendar/view/use-calendar-view-mode';
import type { CalendarViewMode } from '@/modules/calendar/model/calendar-view-mode';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';
import { CalendarTable } from './calendar-table';

// The side panel and the summary look this far ahead.
const UPCOMING_DAYS = 14;

const NAV_BUTTON =
  'inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 max-[640px]:h-10 max-[640px]:min-w-10';
const SEGMENT =
  'inline-flex h-7 flex-1 cursor-pointer items-center justify-center rounded-[2px] px-3 text-xs font-medium whitespace-nowrap transition-colors max-[640px]:h-9';

/** Ticks once a minute so "happening now" and past styling stay current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function matchesSearch(event: ICalendarEventItem, query: string): boolean {
  return [event.title, event.location, event.description, event.createdByName, event.sourceChatName]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

export function CalendarScreen() {
  const queryClient = useQueryClient();
  const { locale, t } = useLocale();
  const isPhone = useIsPhone();
  const now = useNow();
  const todayKey = toDateKey(now);

  // Remembered per layout in localStorage. null = never chosen: phones start on the agenda,
  // larger screens on the month grid.
  const [chosenViewMode, setChosenViewMode] = useStoredCalendarViewMode(
    isPhone ? 'phone' : 'desktop',
  );
  const viewMode: CalendarViewMode = isPhone
    ? chosenViewMode === 'month'
      ? 'month'
      : 'agenda'
    : chosenViewMode === 'list'
      ? 'list'
      : 'month';
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unsyncedOnly, setUnsyncedOnly] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<CalendarSheetTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dashboard = useDashboardQuery();
  const monthRange = useMemo(() => getCalendarGridRange(currentMonth), [currentMonth]);
  // Re-anchored when the day changes, not on every minute tick.
  const upcomingRange = useMemo(
    () => getDaysRange(new Date(`${todayKey}T00:00`), UPCOMING_DAYS + 1),
    [todayKey],
  );
  const agendaStart = useMemo(() => getWeekDays(selectedDate)[0], [selectedDate]);
  const agendaRange = useMemo(() => getDaysRange(agendaStart, 7 + AGENDA_DAYS), [agendaStart]);

  const monthQuery = useCalendarEventsQuery(monthRange);
  const upcomingQuery = useCalendarEventsQuery(upcomingRange);
  const agendaQuery = useCalendarEventsQuery(agendaRange, viewMode === 'agenda');

  const query = search.trim().toLowerCase();
  const applyFilters = useMemo(
    () => (events: ICalendarEventItem[] | undefined) =>
      (events ?? []).filter(
        (event) =>
          (!query || matchesSearch(event, query)) && (!unsyncedOnly || isEventUnsynced(event)),
      ),
    [query, unsyncedOnly],
  );

  const monthEvents = useMemo(() => applyFilters(monthQuery.data), [applyFilters, monthQuery.data]);
  const monthByDate = useMemo(() => groupEventsByDate(monthEvents), [monthEvents]);
  const upcomingByDate = useMemo(
    () => groupEventsByDate(applyFilters(upcomingQuery.data)),
    [applyFilters, upcomingQuery.data],
  );
  const agendaByDate = useMemo(
    () => groupEventsByDate(applyFilters(agendaQuery.data)),
    [applyFilters, agendaQuery.data],
  );

  // Summary counts ignore the search and filter: they describe the calendar, not the view.
  const summary = useMemo(() => {
    const upcoming = upcomingQuery.data ?? [];
    const month = monthQuery.data ?? [];
    const todayStart = startOfDay(now).getTime();
    const todayEnd = addDays(now, 1).getTime();
    const weekEnd = addDays(now, 7).getTime();
    const overlaps = (event: ICalendarEventItem, from: number, to: number) =>
      new Date(event.startAt ?? 0).getTime() < to &&
      new Date(event.endAt ?? event.startAt ?? 0).getTime() > from;
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getTime();
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1).getTime();
    const unsyncedIds = new Set(
      [...month, ...upcoming].filter(isEventUnsynced).map((event) => event.id),
    );
    return {
      today: upcoming.filter((event) => overlaps(event, todayStart, todayEnd)).length,
      next7Days: upcoming.filter((event) => overlaps(event, now.getTime(), weekEnd)).length,
      inMonth: month.filter((event) => overlaps(event, monthStart, monthEnd)).length,
      unsynced: unsyncedIds.size,
    };
  }, [currentMonth, monthQuery.data, now, upcomingQuery.data]);

  // Month name and year apart, so the phone toolbar keeps "Tháng 10 2026" on one line.
  const monthName = useMemo(
    () => new Intl.DateTimeFormat(localeTag(locale), { month: 'long' }).format(currentMonth),
    [currentMonth, locale],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all() });
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => startTransition(() => setToastMessage(null)), 3000);
  };

  const selectDate = (date: Date) => {
    const day = startOfDay(date);
    setSelectedDate(day);
    if (
      day.getFullYear() !== currentMonth.getFullYear() ||
      day.getMonth() !== currentMonth.getMonth()
    ) {
      setCurrentMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    }
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(next);
    // Land on today when it is in that month, else on the 1st, so the day panels follow.
    const today = startOfDay(now);
    setSelectedDate(
      today.getFullYear() === next.getFullYear() && today.getMonth() === next.getMonth()
        ? today
        : next,
    );
  };

  const goToday = () => selectDate(now);
  const openEvent = (event: ICalendarEventItem) => setSheetTarget({ kind: 'event', event });
  const openCreate = () => setSheetTarget({ kind: 'create', day: selectedDate });

  const isGoogleConnected = dashboard.data?.user.googleConnected;
  const isLoading = monthQuery.isLoading;
  const isAgendaLoading = agendaQuery.isLoading;
  const segments: Array<{ mode: CalendarViewMode; label: string }> = isPhone
    ? [
        { mode: 'agenda', label: t('calendar.view.agenda') },
        { mode: 'month', label: t('calendar.view.grid') },
      ]
    : [
        { mode: 'month', label: t('calendar.view.grid') },
        { mode: 'list', label: t('calendar.view.table') },
      ];
  const showSearchInput = !isPhone || isSearchOpen || search.length > 0;

  if (monthQuery.isError) {
    return (
      <section
        className="flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
        role="alert"
      >
        <strong>{t('dashboard.error.title')}</strong>
        <button
          type="button"
          className="cursor-pointer rounded-[2px] bg-rose-600 px-2 py-0.5 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
          onClick={refresh}
        >
          {t('common.retry')}
        </button>
      </section>
    );
  }

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          className={`${TOAST_POSITION} rounded bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
        >
          {toastMessage}
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label={t('calendar.title')}>
        {isGoogleConnected === false && (
          <p className="m-0 rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            {t('calendar.localOnlyTip')}
          </p>
        )}

        <CalendarSummaryStrip
          today={summary.today}
          next7Days={summary.next7Days}
          inMonth={summary.inMonth}
          unsynced={summary.unsynced}
          unsyncedOnly={unsyncedOnly}
          onToggleUnsynced={() => setUnsyncedOnly((value) => !value)}
        />

        <div className="rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800 max-[640px]:gap-2 max-[640px]:px-2">
            <div className="flex min-w-0 items-center gap-1 max-[640px]:w-full">
              <button
                type="button"
                className={NAV_BUTTON}
                onClick={() => shiftMonth(-1)}
                aria-label={t('calendar.nav.prev')}
              >
                ‹
              </button>
              <h2 className="m-0 min-w-[9.5rem] truncate px-1 text-center text-sm font-bold whitespace-nowrap text-slate-900 dark:text-slate-100 max-[640px]:min-w-0 max-[640px]:flex-1">
                <span className="capitalize">{monthName}</span>{' '}
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  {currentMonth.getFullYear()}
                </span>
              </h2>
              <button
                type="button"
                className={NAV_BUTTON}
                onClick={() => shiftMonth(1)}
                aria-label={t('calendar.nav.next')}
              >
                ›
              </button>
              <button type="button" className={`${NAV_BUTTON} ml-1`} onClick={goToday}>
                {t('common.today')}
              </button>
              {isPhone && (
                <button
                  type="button"
                  className={NAV_BUTTON}
                  onClick={() => setIsSearchOpen((value) => !value)}
                  aria-label={t('calendar.search.open')}
                  aria-expanded={showSearchInput}
                >
                  <SearchIcon />
                </button>
              )}
            </div>

            <div
              className="flex rounded-[3px] border border-slate-300 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60 max-[640px]:w-full"
              role="group"
              aria-label={t('calendar.title')}
            >
              {segments.map((segment) => (
                <button
                  key={segment.mode}
                  type="button"
                  aria-pressed={viewMode === segment.mode}
                  onClick={() => setChosenViewMode(segment.mode)}
                  className={`${SEGMENT} ${
                    viewMode === segment.mode
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'bg-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {segment.label}
                </button>
              ))}
            </div>

            {showSearchInput && (
              <input
                type="search"
                className="ml-auto h-7 w-52 rounded-[3px] border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[960px]:ml-0 max-[640px]:h-10 max-[640px]:w-full max-[640px]:text-[15px]"
                placeholder={t('table.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t('table.searchPlaceholder')}
                autoFocus={isPhone && isSearchOpen}
              />
            )}

            <button
              type="button"
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[3px] border border-slate-900 bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500 max-[960px]:hidden"
              onClick={openCreate}
            >
              + {t('calendar.add')}
            </button>
          </div>

          {unsyncedOnly && (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="min-w-0 flex-1">{t('calendar.filter.unsyncedOnly')}</span>
              <button
                type="button"
                className="cursor-pointer rounded-[2px] border-0 !bg-transparent px-1.5 py-0.5 font-semibold underline-offset-2 hover:underline max-[640px]:py-2"
                onClick={() => setUnsyncedOnly(false)}
              >
                {t('calendar.filter.clear')}
              </button>
            </div>
          )}

          <div className="p-3 max-[640px]:p-2">
            {viewMode === 'agenda' ? (
              <CalendarAgenda
                eventsByDate={agendaByDate}
                selectedDate={selectedDate}
                now={now}
                loading={isAgendaLoading}
                onSelectDate={selectDate}
                onOpenEvent={openEvent}
              />
            ) : viewMode === 'list' ? (
              <CalendarTable
                id="calendar"
                ariaLabel={t('dashboard.calendar')}
                events={monthEvents}
                loading={isLoading}
                emptyMessage={t('dashboard.noCalendar')}
                onStartEdit={openEvent}
              />
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-3 max-[1180px]:grid-cols-1">
                <div aria-busy={isLoading}>
                  <CalendarGrid
                    eventsByDate={monthByDate}
                    currentMonth={currentMonth}
                    selectedDate={selectedDate}
                    now={now}
                    onSelectDate={selectDate}
                    onOpenEvent={openEvent}
                  />
                </div>
                <aside className="flex flex-col gap-4 min-[1181px]:sticky min-[1181px]:top-3">
                  <CalendarDayList
                    groups={buildDayGroups(monthByDate, selectedDate, 1)}
                    now={now}
                    onOpenEvent={openEvent}
                  />
                  {!isPhone && (
                    <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <h3 className="m-0 text-xs font-bold text-slate-900 dark:text-slate-100">
                        {t('calendar.upcoming')}
                      </h3>
                      <CalendarDayList
                        groups={buildDayGroups(
                          upcomingByDate,
                          addDays(now, 1),
                          UPCOMING_DAYS,
                        ).filter((group) => group.events.length > 0)}
                        now={now}
                        onOpenEvent={openEvent}
                        compact
                        emptyMessage={t('calendar.upcoming.empty')}
                      />
                    </div>
                  )}
                </aside>
              </div>
            )}
          </div>
        </div>
      </section>

      <MobileActionBar>
        <button
          type="button"
          className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white dark:border-sky-600 dark:bg-sky-600 dark:text-white`}
          onClick={openCreate}
        >
          + {t('calendar.add')}
        </button>
      </MobileActionBar>

      <CalendarEventSheet
        target={sheetTarget}
        onClose={() => setSheetTarget(null)}
        onNotify={showToast}
      />
    </>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
