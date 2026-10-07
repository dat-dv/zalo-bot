'use client';

import { useMemo } from 'react';
import { localeTag, type ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { getEventDateKeys } from '../../model/calendar-date-utils';

interface ICalendarGridProps {
  events: ICalendarEventItem[];
  currentDate: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onEdit: (item: ICalendarEventItem) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  editDraft: {
    summary: string;
    location: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
  };
  onEditDraftChange: (
    updater: (prev: {
      summary: string;
      location: string;
      description: string;
      startDateTime: string;
      endDateTime: string;
    }) => {
      summary: string;
      location: string;
      description: string;
      startDateTime: string;
      endDateTime: string;
    },
  ) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

interface ICalendarCell {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  dateKey: string;
  events: ICalendarEventItem[];
}

export function CalendarGrid({
  events,
  currentDate,
  selectedDate,
  onSelectDate,
  onEdit,
  onDelete,
  editingId,
  editDraft,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  isDeleting,
}: ICalendarGridProps) {
  const { locale, t } = useLocale();

  const dayHeaders = [
    t('calendar.day.mon'),
    t('calendar.day.tue'),
    t('calendar.day.wed'),
    t('calendar.day.thu'),
    t('calendar.day.fri'),
    t('calendar.day.sat'),
    t('calendar.day.sun'),
  ];

  const toDateKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ICalendarEventItem[]>();
    for (const event of events) {
      for (const key of getEventDateKeys(event)) {
        const list = map.get(key) || [];
        list.push(event);
        map.set(key, list);
      }
    }
    return map;
  }, [events]);

  const cells = useMemo<ICalendarCell[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const todayKey = toDateKey(new Date());
    const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday as 0, Sunday as 6
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const result: ICalendarCell[] = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNumber = prevMonthLastDay - i;
      const date = new Date(year, month - 1, dayNumber);
      const key = toDateKey(date);
      result.push({
        date,
        dayNumber,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        dateKey: key,
        events: eventsByDate.get(key) || [],
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      result.push({
        date,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        dateKey: key,
        events: eventsByDate.get(key) || [],
      });
    }

    // Trailing days from next month to complete 35 or 42 grid cells
    const remainingSlots = (7 - (result.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const date = new Date(year, month + 1, i);
      const key = toDateKey(date);
      result.push({
        date,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        dateKey: key,
        events: eventsByDate.get(key) || [],
      });
    }

    return result;
  }, [currentDate, selectedDate, eventsByDate]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate);
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(localeTag(locale), {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  };

  const formatFullDate = (d: Date) => {
    return new Intl.DateTimeFormat(localeTag(locale), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  };

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* 7 Day Header */}
      <div
        className="grid grid-cols-7 rounded-t border border-slate-200 bg-slate-100 text-center dark:border-slate-800 dark:bg-slate-800"
        role="row"
      >
        {dayHeaders.map((header) => (
          <div
            key={header}
            className="px-1 py-2 text-[11px] font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400"
            role="columnheader"
          >
            {header}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        className="grid grid-cols-7 overflow-hidden rounded-b border-b border-l border-slate-200 dark:border-slate-800"
        role="grid"
        aria-label={t('dashboard.calendar')}
      >
        {cells.map((cell) => {
          return (
            <button
              type="button"
              key={cell.dateKey}
              className={`flex min-h-[96px] cursor-pointer flex-col items-stretch border-t border-r border-slate-200 p-1.5 text-left outline-none transition-colors dark:border-slate-800 ${
                cell.isCurrentMonth
                  ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80'
                  : 'bg-slate-50/60 opacity-55 hover:bg-slate-100/70 dark:bg-slate-950/60 dark:hover:bg-slate-950'
              } ${cell.isToday ? '!bg-sky-50 dark:!bg-sky-950/40' : ''} ${
                cell.isSelected
                  ? '!bg-emerald-50 shadow-[inset_0_0_0_2px_#22c55e] dark:!bg-emerald-950/40 dark:shadow-[inset_0_0_0_2px_#16a34a]'
                  : ''
              }`}
              onClick={() => onSelectDate(cell.date)}
              aria-label={`${cell.dateKey}, ${cell.events.length} ${t('dashboard.calendar')}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex size-[22px] items-center justify-center rounded-full text-xs ${
                    cell.isToday
                      ? 'bg-blue-600 font-bold text-white'
                      : 'font-medium text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {cell.dayNumber}
                </span>
                {cell.events.length > 0 && (
                  <span
                    className="rounded-full bg-slate-200 px-1.5 py-px text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    title={t('table.rowsCount', { count: cell.events.length })}
                  >
                    {cell.events.length}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 overflow-hidden">
                {cell.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-1 overflow-hidden rounded-[3px] border border-blue-200 bg-blue-50 px-1 py-0.5 text-[11px] text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:border-blue-700 dark:hover:bg-blue-900"
                    title={`${formatTime(event.startAt)} - ${event.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(cell.date);
                    }}
                  >
                    <span className="shrink-0 text-[10px] font-semibold opacity-85">
                      {formatTime(event.startAt)}
                    </span>
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Detail Panel */}
      {selectedDate && (
        <div className="rounded border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <h3 className="m-0 text-[13px] font-semibold text-slate-900 capitalize dark:text-slate-100">
              {t('calendar.selectedDayEvents', { date: formatFullDate(selectedDate) })}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {t('table.rowsCount', { count: selectedDayEvents.length })}
            </span>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-slate-400">
              <p>{t('calendar.noEventsOnDay')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {selectedDayEvents.map((event) => {
                const isEditing = editingId === event.id;

                if (isEditing) {
                  return (
                    <div
                      key={event.id}
                      className="flex flex-col gap-2 rounded border border-blue-500 bg-white p-3 dark:border-blue-500 dark:bg-slate-900"
                    >
                      <div className="flex w-full flex-col gap-2">
                        <div>
                          <input
                            type="text"
                            className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                            value={editDraft.summary}
                            onChange={(e) =>
                              onEditDraftChange((prev) => ({ ...prev, summary: e.target.value }))
                            }
                            placeholder={t('calendar.placeholder.title')}
                            autoFocus
                            required
                            aria-label={t('calendar.placeholder.title')}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
                          <input
                            type="datetime-local"
                            className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                            value={editDraft.startDateTime}
                            onChange={(e) =>
                              onEditDraftChange((prev) => ({
                                ...prev,
                                startDateTime: e.target.value,
                              }))
                            }
                            aria-label={t('dashboard.columns.date')}
                          />
                          <input
                            type="datetime-local"
                            className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                            value={editDraft.endDateTime}
                            onChange={(e) =>
                              onEditDraftChange((prev) => ({
                                ...prev,
                                endDateTime: e.target.value,
                              }))
                            }
                            aria-label={t('calendar.columns.endAt')}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
                          <input
                            type="text"
                            className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                            value={editDraft.location}
                            onChange={(e) =>
                              onEditDraftChange((prev) => ({ ...prev, location: e.target.value }))
                            }
                            placeholder={t('calendar.placeholder.location')}
                            aria-label={t('calendar.placeholder.location')}
                          />
                          <input
                            type="text"
                            className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                            value={editDraft.description}
                            onChange={(e) =>
                              onEditDraftChange((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder={t('calendar.placeholder.description')}
                            aria-label={t('calendar.placeholder.description')}
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            className="inline-flex min-h-7 items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                            onClick={() => onSaveEdit(event.id)}
                            disabled={isSaving || !editDraft.summary.trim()}
                          >
                            ✓ {t('calendar.actions.save')}
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-7 items-center justify-center rounded-[3px] border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            onClick={onCancelEdit}
                            disabled={isSaving}
                          >
                            ✕ {t('calendar.actions.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 inline-block rounded-[3px] bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                        ⏰ {formatTime(event.startAt)}
                        {event.endAt ? ` − ${formatTime(event.endAt)}` : ''}
                      </div>
                      <h4 className="m-0 mb-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {event.title}
                      </h4>
                      {event.location && (
                        <p className="m-0 mb-1 text-xs text-slate-500 dark:text-slate-400">
                          📍 {event.location}
                        </p>
                      )}
                      {event.description && (
                        <p className="m-0 text-xs whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex h-[22px] min-h-[22px] cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        onClick={() => onEdit(event)}
                        title={t('calendar.actions.edit')}
                      >
                        ✎ {t('calendar.actions.edit')}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-[22px] min-h-[22px] cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-rose-900 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                        onClick={() => onDelete(event.id)}
                        disabled={isDeleting}
                        title={t('calendar.actions.delete')}
                      >
                        🗑 {t('calendar.actions.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
