'use client';

import { useMemo } from 'react';
import {
  localeTag,
  type IReminderTargetChannel,
  type ITaskListItem,
  type TranslationKey,
} from '@zalobot/contracts';
import { useIsCompact } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import type { ReminderTargetDraft } from '@/modules/reminders/model/reminder-target';
import type { ReminderTimeDraft } from '@/modules/reminders/model/reminder-times';
import type { ReminderNagDraft } from '@/modules/reminders/model/reminder-nag';
import { ReminderNagFields } from './reminder-nag-fields';
import { ReminderTimesField, ReminderTimesSummary } from './reminder-times-field';
import { INLINE_EDIT_FIELD as EDIT_FIELD, ReminderTargetFields } from './reminder-target-fields';
import { ReminderTargetSummary } from './reminder-target-summary';

export type TaskEditDraft = {
  title: string;
  notes: string;
  due: string;
  status: 'needsAction' | 'completed';
  /** Reminder times; no filled row clears the reminder. */
  remindTimes: ReminderTimeDraft[];
  /** Empty chat = keep the current one, or the user's private chat for a new reminder. */
  remindTarget: ReminderTargetDraft;
  /** Remind again until done, shared by all times. */
  nag: ReminderNagDraft;
};

export type TasksTableProps = {
  id?: string;
  tasks: ITaskListItem[];
  ariaLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  editingId?: string | null;
  editDraft?: TaskEditDraft;
  onStartEdit?: (item: ITaskListItem) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (id: string) => void | Promise<void>;
  onToggleStatus?: (item: ITaskListItem) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onChangeEditDraft?: React.Dispatch<React.SetStateAction<TaskEditDraft>>;
  isPending?: boolean;
  /** Show who made each task (the full /tasks page). */
  showOrigin?: boolean;
  /** Show and edit each task's reminder (the full /tasks page). */
  showReminder?: boolean;
  /** Chats a reminder can be sent to, for the inline edit. */
  reminderChannels?: readonly IReminderTargetChannel[];
};

const SOURCE_LABEL: Record<NonNullable<ITaskListItem['source']>, TranslationKey> = {
  zalo: 'tasks.source.zalo',
  dashboard: 'tasks.source.dashboard',
};

export function TasksTable({
  id = 'tasks-table',
  tasks,
  ariaLabel,
  emptyMessage,
  loading = false,
  editingId,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleStatus,
  onDelete,
  onChangeEditDraft,
  isPending = false,
  showOrigin = false,
  showReminder = false,
  reminderChannels = [],
}: TasksTableProps) {
  const { locale, t } = useLocale();
  // Compact screens edit inside the row sheet; focusing a field there would pop the keyboard.
  const isCompact = useIsCompact();

  const columns = useMemo<DataTableColumn<ITaskListItem>[]>(() => {
    const hasActions = Boolean(onStartEdit || onSaveEdit || onDelete);
    const date = (value?: string) =>
      value
        ? new Intl.DateTimeFormat(localeTag(locale), {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(value))
        : t('common.notSet');
    const shortDate = (value?: string) =>
      value
        ? new Intl.DateTimeFormat(localeTag(locale), { day: '2-digit', month: '2-digit' }).format(
            new Date(value),
          )
        : null;
    const statusLabel = (item: ITaskListItem) =>
      item.status === 'completed' ? t('tasks.status.completed') : t('tasks.status.needsAction');

    const list: DataTableColumn<ITaskListItem>[] = [
      {
        id: 'status',
        header: t('tasks.columns.status'),
        minWidth: '130px',
        width: '130px',
        hideable: false,
        mobileSlot: 'secondary',
        mobileCell: statusLabel,
        cell: (item) => {
          const isEditing = editingId === item.id;
          if (isEditing && editDraft && onChangeEditDraft) {
            return (
              <select
                className={EDIT_FIELD}
                value={editDraft.status}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({
                    ...prev,
                    status: e.target.value as 'needsAction' | 'completed',
                  }))
                }
                aria-label={t('tasks.columns.status')}
              >
                <option value="needsAction">{t('tasks.status.needsAction')}</option>
                <option value="completed">{t('tasks.status.completed')}</option>
              </select>
            );
          }

          const isCompleted = item.status === 'completed';
          return (
            <label className="inline-flex cursor-pointer items-center gap-1.5 select-none max-[960px]:min-h-10 max-[960px]:pr-2">
              <input
                type="checkbox"
                className="cursor-pointer accent-slate-900 dark:accent-sky-500"
                checked={isCompleted}
                onChange={() => void onToggleStatus?.(item)}
                disabled={!onToggleStatus}
                aria-label={t('tasks.actions.complete')}
              />
              <span
                className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {statusLabel(item)}
              </span>
            </label>
          );
        },
      },
      {
        id: 'title',
        header: t('dashboard.columns.title'),
        minWidth: '220px',
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
                className={EDIT_FIELD}
                value={editDraft.title}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('tasks.placeholder.title')}
                autoFocus={!isCompact}
                required
                aria-label={t('dashboard.columns.title')}
              />
            );
          }
          return (
            <span
              className={`font-semibold select-none ${onStartEdit ? 'cursor-pointer' : ''} ${
                item.status === 'completed'
                  ? 'text-slate-400 line-through opacity-70 dark:text-slate-500'
                  : 'text-slate-900 dark:text-slate-100'
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
        id: 'notes',
        header: t('tasks.columns.notes'),
        minWidth: '200px',
        mobileSlot: 'secondary',
        mobileCell: (item) => item.notes || null,
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
                className={EDIT_FIELD}
                value={editDraft.notes}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, notes: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('tasks.placeholder.notes')}
                aria-label={t('tasks.columns.notes')}
              />
            );
          }
          return (
            <span
              className={`text-[11.5px] text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.notes || undefined}
            >
              {item.notes || '—'}
            </span>
          );
        },
      },
      {
        id: 'dueAt',
        header: t('dashboard.columns.dueDate'),
        align: 'right',
        minWidth: '150px',
        mobileSlot: 'trailing',
        mobileCell: (item) => shortDate(item.dueAt),
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
                type="date"
                className={EDIT_FIELD}
                value={editDraft.due}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, due: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                aria-label={t('dashboard.columns.dueDate')}
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
              {date(item.dueAt)}
            </span>
          );
        },
      },
      ...(showReminder
        ? [
            {
              id: 'remindAt',
              header: t('tasks.columns.remindAt'),
              align: 'right',
              minWidth: '170px',
              cell: (item: ITaskListItem) => {
                if (
                  editingId === item.id &&
                  editDraft &&
                  onChangeEditDraft &&
                  onSaveEdit &&
                  onCancelEdit
                ) {
                  return (
                    <div className="grid min-w-[200px] gap-1">
                      <ReminderTimesField
                        compact
                        value={editDraft.remindTimes}
                        onChange={(remindTimes) =>
                          onChangeEditDraft((prev) => ({ ...prev, remindTimes }))
                        }
                        onEnter={() => void onSaveEdit(item.id)}
                        onEscape={onCancelEdit}
                        ariaLabel={t('tasks.columns.remindAt')}
                      />
                      <ReminderNagFields
                        compact
                        kind="task"
                        value={editDraft.nag}
                        onChange={(nag) => onChangeEditDraft((prev) => ({ ...prev, nag }))}
                      />
                      <ReminderTargetFields
                        compact
                        value={editDraft.remindTarget}
                        onChange={(remindTarget) =>
                          onChangeEditDraft((prev) => ({ ...prev, remindTarget }))
                        }
                        channels={reminderChannels}
                        savedChat={
                          item.remindChatId
                            ? { id: item.remindChatId, name: item.remindChatName }
                            : undefined
                        }
                      />
                    </div>
                  );
                }
                if (!item.remindAt) {
                  return <span className="text-[11.5px] text-slate-400">—</span>;
                }
                return (
                  <span
                    className={`flex flex-col items-end text-[11.5px] leading-tight text-slate-700 select-none dark:text-slate-300 ${
                      onStartEdit ? 'cursor-pointer' : ''
                    }`}
                    onDoubleClick={() => onStartEdit?.(item)}
                  >
                    <ReminderTimesSummary
                      remindAt={item.remindAt}
                      times={item.remindTimes}
                      format={date}
                    />
                    <ReminderTargetSummary
                      chatName={item.remindChatName}
                      users={item.remindUsers}
                      mode={item.remindMode}
                    />
                  </span>
                );
              },
            } satisfies DataTableColumn<ITaskListItem>,
          ]
        : []),
      {
        id: 'updatedAt',
        header: t('tasks.columns.updatedAt'),
        align: 'right',
        minWidth: '130px',
        defaultHidden: false,
        cell: (item) => (
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
            {date(item.updatedAt)}
          </span>
        ),
      },
    ];

    if (showOrigin) {
      list.push({
        id: 'origin',
        header: t('tasks.columns.origin'),
        minWidth: '160px',
        cell: (item) => {
          const who =
            item.createdByName ?? (item.source ? t(SOURCE_LABEL[item.source]) : undefined);
          return (
            <span className="flex flex-col text-[11.5px] leading-tight">
              <span className="text-slate-700 dark:text-slate-300">{who ?? '—'}</span>
              {item.sourceChatName && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('tasks.meta.inChat', { chat: item.sourceChatName })}
                </span>
              )}
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
        minWidth: '130px',
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
                  title={t('tasks.actions.save')}
                >
                  ✓ {t('tasks.actions.save')}
                </button>
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.secondary}`}
                  onClick={onCancelEdit}
                  disabled={isPending}
                  title={t('tasks.actions.cancel')}
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
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.secondary}`}
                  onClick={() => onStartEdit(item)}
                  title={t('tasks.actions.edit')}
                >
                  {t('tasks.actions.edit')}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.dangerSoft}`}
                  onClick={() => void onDelete(item.id)}
                  title={t('tasks.actions.delete')}
                >
                  {t('tasks.actions.delete')}
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
    onToggleStatus,
    reminderChannels,
    showOrigin,
    showReminder,
    t,
  ]);

  return (
    <DataTable
      id={id}
      ariaLabel={ariaLabel ?? t('dashboard.tasks')}
      rows={tasks}
      emptyMessage={emptyMessage ?? t('dashboard.noTasks')}
      columns={columns}
      getRowKey={(item) => item.id}
      loading={loading}
    />
  );
}
