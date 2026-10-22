'use client';

import { useEffect, useMemo, useState } from 'react';
import { localeTag, type ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
  Modal,
} from '@/shared/ui/modal';
import {
  addDays,
  formatEventTime,
  getEventDateKeys,
  getWeekDays,
  toDateKey,
  type CalendarEventDraft,
} from '../../model/calendar-date-utils';
import { CalendarEventFields } from './calendar-event-fields';

interface ICalendarAgendaProps {
  events: ICalendarEventItem[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  loading: boolean;
  onEdit: (item: ICalendarEventItem) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  editDraft: CalendarEventDraft;
  onEditDraftChange: (updater: (prev: CalendarEventDraft) => CalendarEventDraft) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

interface IAgendaDay {
  date: Date;
  key: string;
  events: ICalendarEventItem[];
}

const FOOTER_BUTTON =
  'inline-flex min-h-7 cursor-pointer items-center justify-center rounded-[3px] border px-2.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50';

/**
 * Phone view of the calendar: a 7-day strip to pick a day, then the selected day and the
 * rest of its week as a flat list grouped by day. Tapping an event opens a bottom sheet
 * with its details, where Edit swaps in the same fields the month grid uses.
 */
export function CalendarAgenda({
  events,
  selectedDate,
  onSelectDate,
  loading,
  onEdit,
  onDelete,
  editingId,
  editDraft,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  isDeleting,
}: ICalendarAgendaProps) {
  const { locale, t } = useLocale();
  const tag = localeTag(locale);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const dayHeaders = [
    t('calendar.day.mon'),
    t('calendar.day.tue'),
    t('calendar.day.wed'),
    t('calendar.day.thu'),
    t('calendar.day.fri'),
    t('calendar.day.sat'),
    t('calendar.day.sun'),
  ];

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ICalendarEventItem[]>();
    for (const event of events) {
      for (const key of getEventDateKeys(event)) {
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
    }
    return map;
  }, [events]);

  const week = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selectedDate);

  // Selected day first (even when empty), then the later days of its week that have events.
  const agendaDays = useMemo<IAgendaDay[]>(
    () =>
      week
        .filter((date) => toDateKey(date) >= selectedKey)
        .map((date) => {
          const key = toDateKey(date);
          return { date, key, events: eventsByDate.get(key) ?? [] };
        })
        .filter((day) => day.key === selectedKey || day.events.length > 0),
    [week, selectedKey, eventsByDate],
  );

  const openEvent = openEventId ? events.find((event) => event.id === openEventId) : undefined;
  const isEditingOpenEvent = openEvent !== undefined && editingId === openEvent.id;

  // Close the sheet once its event leaves the list (deleted, filtered out by search).
  useEffect(() => {
    if (openEventId !== null && !openEvent) setOpenEventId(null);
  }, [openEventId, openEvent]);

  const closeSheet = () => {
    if (isEditingOpenEvent) onCancelEdit();
    setOpenEventId(null);
  };

  const formatDayHeading = (date: Date) =>
    new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

  const formatTimeRange = (event: ICalendarEventItem) => {
    const start = formatEventTime(event.startAt, tag);
    if (!start) return t('calendar.allDay');
    const end = formatEventTime(event.endAt, tag);
    return end ? `${start} − ${end}` : start;
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-2 dark:border-slate-800">
        <button
          type="button"
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onSelectDate(addDays(selectedDate, -7))}
          aria-label={t('calendar.agenda.prevWeek')}
        >
          &lt;
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
          {week.map((date, index) => {
            const key = toDateKey(date);
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            const count = eventsByDate.get(key)?.length ?? 0;
            return (
              <button
                type="button"
                key={key}
                className={`relative flex h-10 cursor-pointer flex-col items-center justify-center gap-px rounded-[3px] border leading-none transition-colors ${
                  isSelected
                    ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-600'
                    : isToday
                      ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
                      : 'border-transparent bg-transparent text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
                onClick={() => onSelectDate(date)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${formatDayHeading(date)}, ${t('table.rowsCount', { count })}`}
              >
                <span className="text-[9.5px] font-semibold uppercase opacity-80">
                  {dayHeaders[index]}
                </span>
                <span className="text-[13px] font-semibold tabular-nums">{date.getDate()}</span>
                <span
                  aria-hidden="true"
                  className={`size-1 rounded-full ${
                    count === 0 ? 'invisible' : isSelected ? 'bg-white' : 'bg-blue-500'
                  }`}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onSelectDate(addDays(selectedDate, 7))}
          aria-label={t('calendar.agenda.nextWeek')}
        >
          &gt;
        </button>
      </div>

      {loading ? (
        <ul className="m-0 list-none p-0" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <li
              key={index}
              className="flex min-h-[52px] items-center gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800"
            >
              <span className="block h-3 w-12 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
              <span className="block h-3 flex-1 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
            </li>
          ))}
        </ul>
      ) : (
        agendaDays.map((day) => (
          // Re-keyed per day, so picking another day eases its list in.
          <section key={day.key} aria-label={formatDayHeading(day.date)} className="animate-row-in">
            <h3
              className={`m-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide capitalize dark:border-slate-800 dark:bg-slate-950/60 ${
                day.key === todayKey
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {formatDayHeading(day.date)}
            </h3>
            {day.events.length === 0 ? (
              <p className="m-0 flex min-h-[52px] items-center justify-center border-b border-slate-100 px-3 text-xs text-slate-400 italic dark:border-slate-800">
                {t('calendar.noEventsOnDay')}
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {day.events.map((event) => {
                  const meta = [event.location, event.description].filter(Boolean).join(' · ');
                  return (
                    <li
                      key={`${day.key}-${event.id}`}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <button
                        type="button"
                        data-press="none"
                        className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 border-0 !bg-transparent px-3 py-2 text-left transition-colors hover:!bg-slate-50 active:!bg-slate-100 dark:hover:!bg-slate-800/60 dark:active:!bg-slate-800"
                        onClick={() => setOpenEventId(event.id)}
                      >
                        <span className="w-[4.5rem] shrink-0 text-[11.5px] font-semibold text-blue-700 tabular-nums dark:text-blue-300">
                          {formatTimeRange(event)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                            {event.title}
                          </span>
                          {meta && (
                            <span className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                              {meta}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}

      {openEvent && (
        <Modal
          open
          onDismiss={isSaving ? undefined : closeSheet}
          dismissOnBackdrop
          ariaLabel={openEvent.title}
          panelClassName="max-w-lg rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <header
            className={`${MODAL_STICKY_HEADER} flex items-center gap-2 border-b border-slate-200 bg-white py-1 pr-1 pl-3 dark:border-slate-800 dark:bg-slate-900`}
          >
            <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {openEvent.title}
            </h2>
            <button
              type="button"
              className={`inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 !bg-transparent text-lg text-slate-500 hover:!bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:!bg-slate-800 dark:hover:text-slate-100 ${MODAL_CLOSE_TAP}`}
              onClick={closeSheet}
              disabled={isSaving}
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </header>

          {isEditingOpenEvent ? (
            <div className="flex flex-col gap-2 px-3 py-3">
              <CalendarEventFields
                draft={editDraft}
                onDraftChange={onEditDraftChange}
                autoFocusTitle={false}
              />
            </div>
          ) : (
            <dl className="m-0 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3 px-3 py-1 text-xs">
              {[
                {
                  id: 'time',
                  label: t('dashboard.columns.date'),
                  value: formatTimeRange(openEvent),
                },
                {
                  id: 'location',
                  label: t('calendar.columns.location'),
                  value: openEvent.location,
                },
                {
                  id: 'description',
                  label: t('calendar.columns.description'),
                  value: openEvent.description,
                },
              ].map((row) => (
                <div
                  key={row.id}
                  className="col-span-2 grid grid-cols-subgrid items-start border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800"
                >
                  <dt className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    {row.label}
                  </dt>
                  <dd className="m-0 min-w-0 whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {row.value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <footer
            className={`${MODAL_STICKY_FOOTER} flex justify-end gap-2 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900`}
          >
            {isEditingOpenEvent ? (
              <>
                <button
                  type="button"
                  className={`${FOOTER_BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${MODAL_FOOTER_TAP}`}
                  onClick={onCancelEdit}
                  disabled={isSaving}
                >
                  {t('calendar.actions.cancel')}
                </button>
                <button
                  type="button"
                  className={`${FOOTER_BUTTON} border-slate-900 bg-slate-900 font-semibold text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${MODAL_FOOTER_TAP}`}
                  onClick={() => onSaveEdit(openEvent.id)}
                  disabled={isSaving || !editDraft.summary.trim()}
                >
                  ✓ {t('calendar.actions.save')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`${FOOTER_BUTTON} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/70 ${MODAL_FOOTER_TAP}`}
                  onClick={() => onDelete(openEvent.id)}
                  disabled={isDeleting}
                >
                  {t('calendar.actions.delete')}
                </button>
                <button
                  type="button"
                  className={`${FOOTER_BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${MODAL_FOOTER_TAP}`}
                  onClick={() => onEdit(openEvent)}
                >
                  {t('calendar.actions.edit')}
                </button>
              </>
            )}
          </footer>
        </Modal>
      )}
    </div>
  );
}
