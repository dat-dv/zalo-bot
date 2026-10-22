'use client';

import { useMemo } from 'react';
import { localeTag, type ICalendarEventItem } from '@zalobot/contracts';
import { useIsCompact } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';

export type CalendarEditDraft = {
  summary: string;
  location: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
};

export type CalendarTableProps = {
  id?: string;
  events: ICalendarEventItem[];
  ariaLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  editingId?: string | null;
  editDraft?: CalendarEditDraft;
  onStartEdit?: (item: ICalendarEventItem) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onChangeEditDraft?: React.Dispatch<React.SetStateAction<CalendarEditDraft>>;
  isPending?: boolean;
};

export function CalendarTable({
  id = 'calendar-table',
  events,
  ariaLabel,
  emptyMessage,
  loading = false,
  editingId,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onChangeEditDraft,
  isPending = false,
}: CalendarTableProps) {
  const { locale, t } = useLocale();
  // Compact screens edit inside the row sheet; focusing a field there would pop the keyboard.
  const isCompact = useIsCompact();

  const columns = useMemo<DataTableColumn<ICalendarEventItem>[]>(() => {
    const hasActions = Boolean(onStartEdit || onSaveEdit || onDelete);
    // All-day events (flag, or a bare `YYYY-MM-DD` from older payloads) show only the day.
    const isAllDayValue = (item: ICalendarEventItem, value: string) =>
      Boolean(item.allDay) || /^\d{4}-\d{2}-\d{2}$/.test(value);
    const toDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    const date = (item: ICalendarEventItem, value?: string) =>
      value
        ? new Intl.DateTimeFormat(localeTag(locale), {
            dateStyle: 'short',
            ...(isAllDayValue(item, value) ? {} : { timeStyle: 'short' }),
          }).format(toDate(value))
        : t('common.notSet');
    const shortStart = (item: ICalendarEventItem) => {
      const value = item.startAt;
      if (!value) return null;
      return new Intl.DateTimeFormat(localeTag(locale), {
        day: '2-digit',
        month: '2-digit',
        ...(isAllDayValue(item, value)
          ? {}
          : { hour: '2-digit', minute: '2-digit', hour12: false }),
      }).format(toDate(value));
    };
    const syncLabel = (item: ICalendarEventItem) => {
      if (!item.sync) return '—';
      if (item.sync.status === 'local') return t('calendar.sync.local');
      if (item.sync.status === 'failed') return t('calendar.sync.failed');
      if (!item.sync.isCurrentAccount) return t('calendar.sync.otherAccount');
      if (item.sync.status === 'pending') return t('calendar.sync.pending');
      return t('calendar.sync.synced');
    };

    const list: DataTableColumn<ICalendarEventItem>[] = [
      {
        id: 'title',
        header: t('dashboard.columns.title'),
        minWidth: '180px',
        hideable: false,
        mobileSlot: 'primary',
        mobileCell: (item) => item.title,
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <input
                type="text"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.summary}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, summary: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('calendar.placeholder.title')}
                autoFocus={!isCompact}
                required
                aria-label={t('dashboard.columns.title')}
              />
            );
          }
          return (
            <span
              className={`font-semibold text-slate-900 select-none dark:text-slate-100 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.title}
            >
              {item.title}
            </span>
          );
        },
      },
      {
        id: 'location',
        header: t('calendar.columns.location'),
        minWidth: '150px',
        mobileSlot: 'secondary',
        mobileCell: (item) => item.location || null,
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <input
                type="text"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.location}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, location: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('calendar.placeholder.location')}
                aria-label={t('calendar.columns.location')}
              />
            );
          }
          return (
            <span
              className={`text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.location || undefined}
            >
              {item.location || '—'}
            </span>
          );
        },
      },
      {
        id: 'description',
        header: t('calendar.columns.description'),
        minWidth: '120px',
        width: '160px',
        defaultHidden: false,
        mobileSlot: 'secondary',
        mobileCell: (item) => item.description || null,
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <input
                type="text"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.description}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('calendar.placeholder.description')}
                aria-label={t('calendar.columns.description')}
              />
            );
          }
          return (
            <span
              className={`block max-w-[200px] truncate text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.description || undefined}
            >
              {item.description || '—'}
            </span>
          );
        },
      },
      {
        id: 'startAt',
        header: t('dashboard.columns.date'),
        align: 'right',
        minWidth: '140px',
        mobileSlot: 'trailing',
        mobileCell: (item) => shortStart(item),
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <input
                type="datetime-local"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.startDateTime}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, startDateTime: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                aria-label={t('dashboard.columns.date')}
              />
            );
          }
          return (
            <span
              className={`text-[11.5px] text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {date(item, item.startAt)}
            </span>
          );
        },
      },
      {
        id: 'endAt',
        header: t('calendar.columns.endAt'),
        align: 'right',
        minWidth: '140px',
        defaultHidden: false,
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <input
                type="datetime-local"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.endDateTime}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, endDateTime: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                aria-label={t('calendar.columns.endAt')}
              />
            );
          }
          return (
            <span
              className={`text-[11.5px] text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {item.endAt && !item.allDay ? date(item, item.endAt) : '—'}
            </span>
          );
        },
      },
      {
        id: 'createdBy',
        header: t('dashboard.columns.createdBy'),
        minWidth: '140px',
        cell: (item) => (
          <span className="text-[11.5px] text-slate-600 dark:text-slate-300">
            {[item.createdByName, item.sourceChatName].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      },
      {
        id: 'sync',
        header: t('calendar.columns.sync'),
        minWidth: '130px',
        cell: (item) => (
          <span
            className="text-[11.5px] text-slate-500 dark:text-slate-400"
            title={item.sync?.accountEmail}
          >
            {syncLabel(item)}
          </span>
        ),
      },
    ];

    if (hasActions) {
      list.push({
        id: 'actions',
        header: t('dashboard.columns.action'),
        align: 'right',
        minWidth: '130px',
        hideable: false,
        cell: (item) => {
          const isEditing = editingId === item.id;
          if (isEditing && editDraft && onSaveEdit && onCancelEdit) {
            return (
              <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-900 bg-slate-900 px-1.5 text-[11px] font-semibold text-white whitespace-nowrap transition-colors hover:bg-slate-800 disabled:opacity-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  onClick={() => void onSaveEdit(item.id)}
                  disabled={isPending || !editDraft.summary.trim()}
                  title={t('calendar.actions.save')}
                >
                  ✓ {t('calendar.actions.save')}
                </button>
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={onCancelEdit}
                  disabled={isPending}
                  title={t('calendar.actions.cancel')}
                >
                  ✕
                </button>
              </div>
            );
          }
          return (
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
              {onStartEdit && (
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() => onStartEdit(item)}
                  title={t('calendar.actions.edit')}
                >
                  {t('calendar.actions.edit')}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-medium text-rose-700 whitespace-nowrap transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/70"
                  onClick={() => void onDelete(item.id)}
                  title={t('calendar.actions.delete')}
                >
                  {t('calendar.actions.delete')}
                </button>
              )}
            </div>
          );
        },
      });
    }

    return list;
  }, [
    editDraft,
    editingId,
    isCompact,
    isPending,
    locale,
    onCancelEdit,
    onChangeEditDraft,
    onDelete,
    onSaveEdit,
    onStartEdit,
    t,
  ]);

  return (
    <DataTable
      id={id}
      ariaLabel={ariaLabel ?? t('dashboard.calendar')}
      rows={events}
      emptyMessage={emptyMessage ?? t('dashboard.noCalendar')}
      columns={columns}
      getRowKey={(item) => item.id}
      loading={loading}
    />
  );
}
