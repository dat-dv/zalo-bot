'use client';

import { useMemo } from 'react';
import {
  localeTag,
  type IReminderListItem,
  type IReminderTargetChannel,
  type ReminderNotifyType,
  type ReminderRepeatType,
} from '@zalobot/contracts';
import { useIsCompact } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import type { ReminderTargetDraft } from '@/modules/reminders/model/reminder-target';
import type { ReminderTimeDraft } from '@/modules/reminders/model/reminder-times';
import { ReminderTargetFields } from './reminder-target-fields';
import { ReminderTimesField, ReminderTimesSummary } from './reminder-times-field';
import { ReminderTargetSummary } from './reminder-target-summary';
import type { ReminderNagDraft } from '@/modules/reminders/model/reminder-nag';
import { ReminderNagFields } from './reminder-nag-fields';

export type ReminderEditDraft = {
  title: string;
  /** Reminder times; at least one filled row. */
  remindTimes: ReminderTimeDraft[];
  notifyType: ReminderNotifyType;
  /** Remind again until marked done, shared by all times (each time has its own repeat). */
  nag: ReminderNagDraft;
  /** Empty chat = keep the current one. */
  target: ReminderTargetDraft;
};

export type RemindersTableProps = {
  id?: string;
  reminders: IReminderListItem[];
  ariaLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  editingId?: string | null;
  editDraft?: ReminderEditDraft;
  onStartEdit?: (item: IReminderListItem) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (id: string) => void | Promise<void>;
  onSnooze?: (item: IReminderListItem) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onChangeEditDraft?: React.Dispatch<React.SetStateAction<ReminderEditDraft>>;
  isPending?: boolean;
  /** Show and edit where each reminder goes (the full /reminders page). */
  showTarget?: boolean;
  /** Chats a reminder can be sent to, for the inline edit. */
  targetChannels?: readonly IReminderTargetChannel[];
  /** Show when each reminder finished (the Done tab); phones show it instead of the schedule. */
  showCompletedAt?: boolean;
};

export function RemindersTable({
  id = 'reminders-table',
  reminders,
  ariaLabel,
  emptyMessage,
  loading = false,
  editingId,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSnooze,
  onDelete,
  onChangeEditDraft,
  isPending = false,
  showTarget = false,
  targetChannels = [],
  showCompletedAt = false,
}: RemindersTableProps) {
  const { locale, t } = useLocale();
  // Compact screens edit inside the row sheet; focusing a field there would pop the keyboard.
  const isCompact = useIsCompact();

  const columns = useMemo<DataTableColumn<IReminderListItem>[]>(() => {
    const hasActions = Boolean(onStartEdit || onSaveEdit || onSnooze || onDelete);
    const date = (value?: string) =>
      value
        ? new Intl.DateTimeFormat(localeTag(locale), {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(value))
        : t('common.notSet');
    const shortDateTime = (value?: string) =>
      value
        ? new Intl.DateTimeFormat(localeTag(locale), {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(value))
        : null;
    const notifyLabel = (item: IReminderListItem) =>
      item.notifyType === 'call' ? t('reminders.notifyType.call') : t('reminders.notifyType.text');
    const everyLabel = (minutes: number) =>
      minutes % 60 === 0
        ? t('reminderRule.hours', { count: minutes / 60 })
        : t('reminderRule.minutes', { count: minutes });
    /** The repeats of the times (each has its own), then reminding again if on. */
    const repeatLabel = (item: IReminderListItem) => {
      // The Home payload has no time list: it carries the legacy repeat of the earliest time.
      const types: ReminderRepeatType[] = item.remindTimes
        ? item.remindTimes.flatMap((time) =>
            time.repeatType && time.repeatType !== 'none' ? [time.repeatType] : [],
          )
        : item.repeatType && item.repeatType !== 'none'
          ? [item.repeatType]
          : [];
      const repeat = types.length
        ? [...new Set(types)].map((type) => t(`reminders.repeatType.${type}`)).join(', ')
        : t('reminders.repeatType.none');
      const nag =
        item.nagEveryMinutes && item.nagCount
          ? t('reminderRule.summaryNag', {
              every: everyLabel(item.nagEveryMinutes),
              count: item.nagCount,
            })
          : '';
      return nag ? `${repeat} · ${nag}` : repeat;
    };

    const list: DataTableColumn<IReminderListItem>[] = [
      {
        id: 'title',
        header: t('dashboard.columns.title'),
        minWidth: '200px',
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
                value={editDraft.title}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('reminders.placeholder.title')}
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
        id: 'notifyType',
        header: t('reminders.columns.notifyType'),
        minWidth: '120px',
        mobileSlot: 'secondary',
        mobileCell: notifyLabel,
        cell: (item) => {
          if (editingId === item.id && editDraft && onChangeEditDraft) {
            return (
              <select
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.notifyType}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({
                    ...prev,
                    notifyType: e.target.value as ReminderNotifyType,
                  }))
                }
                aria-label={t('reminders.columns.notifyType')}
              >
                <option value="text">{t('reminders.notifyType.text')}</option>
                <option value="call">{t('reminders.notifyType.call')}</option>
              </select>
            );
          }
          return (
            <span
              className={`inline-flex items-center rounded-[2px] border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 select-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {item.notifyType === 'call' ? '📞' : '💬'} {notifyLabel(item)}
            </span>
          );
        },
      },
      {
        id: 'remindAt',
        header: t('dashboard.columns.schedule'),
        align: 'right',
        minWidth: '150px',
        mobileSlot: showCompletedAt ? 'secondary' : 'trailing',
        mobileCell: (item) => shortDateTime(item.remindAt),
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <div className="min-w-[200px]">
                <ReminderTimesField
                  compact
                  value={editDraft.remindTimes}
                  onChange={(remindTimes) =>
                    onChangeEditDraft((prev) => ({ ...prev, remindTimes }))
                  }
                  onEnter={() => void onSaveEdit(item.id)}
                  onEscape={onCancelEdit}
                  ariaLabel={t('dashboard.columns.schedule')}
                />
              </div>
            );
          }
          return (
            <span
              className={`text-[11.5px] text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {/* The Home payload has no time list: it shows the next time only. */}
              {item.remindTimes ? (
                <ReminderTimesSummary
                  remindAt={item.remindAt}
                  times={item.remindTimes}
                  format={date}
                />
              ) : (
                date(item.remindAt)
              )}
            </span>
          );
        },
      },
      {
        id: 'repeatType',
        header: t('reminders.columns.repeatType'),
        minWidth: '120px',
        defaultHidden: false,
        mobileSlot: 'secondary',
        mobileCell: repeatLabel,
        cell: (item) => {
          if (editingId === item.id && editDraft && onChangeEditDraft) {
            // Each time's repeat is edited with its time; here only reminding again.
            return (
              <ReminderNagFields
                compact
                kind="reminder"
                value={editDraft.nag}
                onChange={(nag) => onChangeEditDraft((prev) => ({ ...prev, nag }))}
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
              {repeatLabel(item)}
            </span>
          );
        },
      },
    ];

    if (showCompletedAt) {
      list.push({
        id: 'completedAt',
        header: t('reminders.columns.completedAt'),
        align: 'right',
        minWidth: '130px',
        mobileSlot: 'trailing',
        mobileCell: (item) => shortDateTime(item.completedAt),
        cell: (item) => (
          <span className="text-[11.5px] text-slate-500 tabular-nums dark:text-slate-400">
            {date(item.completedAt)}
          </span>
        ),
      });
    }

    if (showTarget) {
      list.push({
        id: 'target',
        header: t('reminders.columns.target'),
        minWidth: '180px',
        cell: (item) => {
          if (editingId === item.id && editDraft && onChangeEditDraft) {
            return (
              <div className="min-w-[200px]">
                <ReminderTargetFields
                  compact
                  value={editDraft.target}
                  onChange={(target) => onChangeEditDraft((prev) => ({ ...prev, target }))}
                  channels={targetChannels}
                  savedChat={item.chatId ? { id: item.chatId, name: item.chatName } : undefined}
                />
              </div>
            );
          }
          return (
            <span
              className={`flex flex-col text-[11.5px] leading-tight select-none ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              <ReminderTargetSummary
                chatName={item.chatName ?? t('reminderTarget.self')}
                users={item.remindUsers}
                mode={item.remindMode}
              />
            </span>
          );
        },
      });
    }

    if (hasActions) {
      list.push({
        id: 'actions',
        header: t('dashboard.columns.action'),
        align: 'right',
        minWidth: '160px',
        hideable: false,
        cell: (item) => {
          const isEditing = editingId === item.id;
          if (isEditing && editDraft && onSaveEdit && onCancelEdit) {
            return (
              <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-semibold whitespace-nowrap ${BUTTON_TONE.primary}`}
                  onClick={() => void onSaveEdit(item.id)}
                  disabled={isPending || !editDraft.title.trim()}
                  title={t('reminders.actions.save')}
                >
                  ✓ {t('reminders.actions.save')}
                </button>
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.secondary}`}
                  onClick={onCancelEdit}
                  disabled={isPending}
                  title={t('reminders.actions.cancel')}
                >
                  ✕
                </button>
              </div>
            );
          }
          return (
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
              {onSnooze && (
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-semibold whitespace-nowrap ${BUTTON_TONE.secondary}`}
                  onClick={() => void onSnooze(item)}
                  title={t('reminders.actions.snooze')}
                >
                  ⏰ +15m
                </button>
              )}
              {onStartEdit && (
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.secondary}`}
                  onClick={() => onStartEdit(item)}
                  title={t('reminders.actions.edit')}
                >
                  {t('reminders.actions.edit')}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.dangerSoft}`}
                  onClick={() => void onDelete(item.id)}
                  title={t('reminders.actions.delete')}
                >
                  {t('reminders.actions.delete')}
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
    onSnooze,
    onStartEdit,
    showCompletedAt,
    showTarget,
    t,
    targetChannels,
  ]);

  return (
    <DataTable
      id={id}
      ariaLabel={ariaLabel ?? t('dashboard.reminders')}
      rows={reminders}
      emptyMessage={emptyMessage ?? t('dashboard.noReminders')}
      columns={columns}
      getRowKey={(item) => item.id}
      loading={loading}
    />
  );
}
