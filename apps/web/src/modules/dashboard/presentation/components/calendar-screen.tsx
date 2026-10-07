'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localeTag, type ICalendarEventItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import { CalendarTable, type CalendarEditDraft } from './calendar-table';

import {
  calendarQueryKeys,
  useCalendarEventsQuery,
  useDeleteCalendarEventMutation,
  useUpdateCalendarEventMutation,
} from '@/modules/calendar/api/calendar-query';
import { CalendarGrid } from '@/modules/calendar/view/calendar-grid';
import { getCalendarGridRange } from '@/modules/calendar/model/calendar-date-utils';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';

export function CalendarScreen() {
  const queryClient = useQueryClient();
  const { locale, t } = useLocale();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CalendarEditDraft>({
    summary: '',
    location: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dashboard = useDashboardQuery();
  const calendarRange = useMemo(() => getCalendarGridRange(currentMonth), [currentMonth]);
  const calendarQuery = useCalendarEventsQuery(calendarRange);
  const updateMutation = useUpdateCalendarEventMutation();
  const deleteMutation = useDeleteCalendarEventMutation();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all() });
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
  };

  const rawList = useMemo(() => calendarQuery.data ?? [], [calendarQuery.data]);

  const isGoogleConnected = dashboard.data?.user.googleConnected;

  const filteredCalendar = useMemo(() => {
    if (!search.trim()) return rawList;
    const q = search.toLowerCase();
    return rawList.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)),
    );
  }, [rawList, search]);

  const formattedMonthYear = useMemo(() => {
    return new Intl.DateTimeFormat(localeTag(locale), {
      month: 'long',
      year: 'numeric',
    }).format(currentMonth);
  }, [currentMonth, locale]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const handleStartEdit = (item: ICalendarEventItem) => {
    setEditingId(item.id);
    setEditDraft({
      summary: item.title,
      location: item.location || '',
      description: item.description || '',
      startDateTime: item.startAt ? item.startAt.slice(0, 16) : '',
      endDateTime: item.endAt ? item.endAt.slice(0, 16) : '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft({
      summary: '',
      location: '',
      description: '',
      startDateTime: '',
      endDateTime: '',
    });
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedSummary = editDraft.summary.trim();
    if (!trimmedSummary) return;

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          summary: trimmedSummary,
          location: editDraft.location.trim() || undefined,
          description: editDraft.description.trim() || undefined,
          startDateTime: editDraft.startDateTime
            ? new Date(editDraft.startDateTime).toISOString()
            : undefined,
          endDateTime: editDraft.endDateTime
            ? new Date(editDraft.endDateTime).toISOString()
            : undefined,
        },
      });
      setEditingId(null);
      showToast(t('calendar.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('calendar.delete.confirm'))) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast(t('calendar.delete.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = dashboard.isLoading || calendarQuery.isLoading;
  const isError = dashboard.isError || calendarQuery.isError;

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 rounded bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {toastMessage}
        </div>
      )}

      {isError ? (
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
      ) : (
        <section className="flex flex-col gap-3" aria-label={t('dashboard.calendar')}>
          <DataPanel
            title={t('dashboard.calendar')}
            description={isGoogleConnected ? undefined : t('dashboard.connectGoogleTip')}
            counter={t('table.rowsCount', { count: filteredCalendar.length })}
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-2 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={handleToday}
                  >
                    {t('common.today')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={handlePrevMonth}
                    aria-label={t('calendar.nav.prev')}
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-[3px] border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={handleNextMonth}
                    aria-label={t('calendar.nav.next')}
                  >
                    &gt;
                  </button>
                  <span className="ml-1 text-xs font-bold text-slate-900 capitalize dark:text-slate-100">
                    {formattedMonthYear}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                        viewMode === 'grid'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setViewMode('grid')}
                    >
                      {t('calendar.view.grid')}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                        viewMode === 'table'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setViewMode('table')}
                    >
                      {t('calendar.view.table')}
                    </button>
                  </div>

                  <input
                    type="search"
                    className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
                    placeholder={t('table.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={t('table.searchPlaceholder')}
                  />
                </div>
              </div>
            }
          >
            {viewMode === 'grid' ? (
              <CalendarGrid
                events={filteredCalendar}
                currentDate={currentMonth}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                editingId={editingId}
                editDraft={editDraft}
                onEditDraftChange={setEditDraft}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                isSaving={updateMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ) : (
              <CalendarTable
                id="calendar"
                ariaLabel={t('dashboard.calendar')}
                events={filteredCalendar}
                loading={isLoading}
                emptyMessage={t('dashboard.noCalendar')}
                editingId={editingId}
                editDraft={editDraft}
                onChangeEditDraft={setEditDraft}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
                isPending={updateMutation.isPending}
              />
            )}
          </DataPanel>
        </section>
      )}
    </>
  );
}
