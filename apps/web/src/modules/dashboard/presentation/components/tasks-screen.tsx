'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  REMINDER_TIME_LIMITS,
  type ITaskListItem,
  type IUpdateTaskRequest,
  type TranslationKey,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DataPanel } from '@/shared/ui/data-table';
import { TasksTable, type TaskEditDraft } from './tasks-table';
import {
  buildReminderTimes,
  isReminderTimesChanged,
  reminderTimeDraftsFrom,
} from '@/modules/reminders/model/reminder-times';
import { reminderApiErrorMessage } from '@/modules/reminders/api/reminder-targets-api';
import { useReminderTargetChannelsQuery } from '@/modules/reminders/api/reminder-targets-query';
import {
  buildReminderTargetFields,
  emptyReminderTargetDraft,
  isTargetChanged,
  reminderTargetDraftFrom,
} from '@/modules/reminders/model/reminder-target';

import { usePeriodFilter, type PeriodGrain } from '@/shared/hooks/use-period-filter';
import { PeriodFilterToolbar } from '@/shared/ui/period-filter-toolbar';
import {
  tasksQueryKeys,
  useTasksQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} from '@/modules/tasks/api/tasks-query';
import { dashboardQueryKeys } from '../../api/dashboard-query';
import { MOBILE_TOOLBAR_ROW, TOAST_POSITION } from '@/shared/ui/touch';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import { CreateTaskDialog } from './create-task-dialog';

const CHIP_PHONE =
  'max-[640px]:shrink-0 max-[640px]:whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px]';

const TASK_GRAINS: PeriodGrain[] = ['day', 'week', 'month', 'quarter', 'year', 'all'];

const EMPTY_EDIT_DRAFT: TaskEditDraft = {
  title: '',
  notes: '',
  due: '',
  status: 'needsAction',
  remindTimes: reminderTimeDraftsFrom(undefined),
  remindTarget: emptyReminderTargetDraft(),
};

export function TasksScreen() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const periodFilter = usePeriodFilter('month');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needsAction' | 'completed'>(
    'needsAction',
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskEditDraft>(EMPTY_EDIT_DRAFT);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const tasksQuery = useTasksQuery();
  const updateMutation = useUpdateTaskMutation();
  const deleteMutation = useDeleteTaskMutation();
  const reminderChannelsQuery = useReminderTargetChannelsQuery(editingId !== null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: tasksQueryKeys.list() });
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
  };

  const rawList = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  // 1. Filter by period first
  const periodTasks = useMemo(() => {
    return rawList.filter((item) => {
      const dateToCheck = item.dueAt || item.updatedAt;
      return periodFilter.isItemInPeriod(dateToCheck);
    });
  }, [rawList, periodFilter]);

  // 2. Compute quick summary stats for selected period
  const stats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let overdue = 0;
    const now = new Date();

    for (const task of periodTasks) {
      const isCompleted = task.status === 'completed';
      if (isCompleted) {
        completed++;
      } else {
        pending++;
        if (task.dueAt && new Date(task.dueAt) < now) {
          overdue++;
        }
      }
    }

    return {
      total: periodTasks.length,
      pending,
      completed,
      overdue,
    };
  }, [periodTasks]);

  // 3. Filter by status & search
  const filteredTasks = useMemo(() => {
    return periodTasks.filter((item) => {
      if (statusFilter !== 'all') {
        const itemStatus = item.status || 'needsAction';
        if (itemStatus !== statusFilter) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) || (item.notes && item.notes.toLowerCase().includes(q))
      );
    });
  }, [periodTasks, statusFilter, search]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const handleStartEdit = (task: ITaskListItem) => {
    setEditingId(task.id);
    setEditDraft({
      title: task.title,
      notes: task.notes || '',
      due: task.dueAt ? task.dueAt.slice(0, 10) : '',
      status: task.status || 'needsAction',
      remindTimes: reminderTimeDraftsFrom(task.remindTimes),
      remindTarget: reminderTargetDraftFrom(task.remindUsers, task.remindMode),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft(EMPTY_EDIT_DRAFT);
  };

  /**
   * Reminder fields of the PATCH, sent only when edited. Unchanged saved times go back as
   * they are, so a time that already went out never blocks saving or is sent again.
   */
  const reminderPatch = (
    task: ITaskListItem | undefined,
  ): { ok: true; patch: IUpdateTaskRequest } | { ok: false; error: TranslationKey } => {
    const times = buildReminderTimes(editDraft.remindTimes);
    if (!times.ok) {
      return {
        ok: false,
        error: times.error === 'pastTime' ? 'tasks.remind.pastTime' : 'reminderTimes.max',
      };
    }
    const timesChanged = isReminderTimesChanged(times.iso, task?.remindTimes);
    const saved = { chatId: task?.remindChatId, users: task?.remindUsers, mode: task?.remindMode };
    // A new reminder always sends its target, so the chat default is checked here too.
    const targetChanged =
      times.iso.length > 0 &&
      (!task?.remindChatId || isTargetChanged(editDraft.remindTarget, saved));
    if (!timesChanged && !targetChanged) return { ok: true, patch: {} };
    if (times.iso.length === 0) return { ok: true, patch: { remindTimes: [] } };

    const patch: IUpdateTaskRequest = timesChanged ? { remindTimes: times.iso } : {};
    if (targetChanged) {
      const target = buildReminderTargetFields(
        editDraft.remindTarget,
        reminderChannelsQuery.data ?? [],
        task?.remindChatId,
      );
      if (!target.ok) return { ok: false, error: 'reminderTarget.channelRequired' };
      patch.remindChatId = target.fields.chatId;
      patch.remindUserIds = target.fields.remindUserIds;
      patch.remindMode = target.fields.remindMode;
    }
    return { ok: true, patch };
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedTitle = editDraft.title.trim();
    if (!trimmedTitle) return;
    const reminder = reminderPatch(rawList.find((task) => task.id === id));
    if (!reminder.ok) {
      showToast(t(reminder.error, { max: REMINDER_TIME_LIMITS.MAX_TIMES }));
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: trimmedTitle,
          // Empty strings clear the notes / due date.
          notes: editDraft.notes.trim(),
          due: editDraft.due ? new Date(`${editDraft.due}T23:59:59.000Z`).toISOString() : '',
          status: editDraft.status,
          ...reminder.patch,
        },
      });
      setEditingId(null);
      showToast(t('tasks.inlineEdit.saved'));
    } catch (err: unknown) {
      // The API explains a rejected reminder (no chat, chat not listened); keep the edit open.
      showToast(reminderApiErrorMessage(err, t('tasks.inlineEdit.error')));
    }
  };

  const handleToggleStatus = async (task: ITaskListItem) => {
    const newStatus: 'needsAction' | 'completed' =
      task.status === 'completed' ? 'needsAction' : 'completed';
    try {
      await updateMutation.mutateAsync({
        id: task.id,
        data: {
          status: newStatus,
        },
      });
      showToast(t('tasks.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteMutation.mutateAsync(pendingDeleteId);
      setPendingDeleteId(null);
      showToast(t('tasks.delete.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = tasksQuery.isLoading;
  const isError = tasksQuery.isError;

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          className={`${TOAST_POSITION} rounded bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900`}
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
        <section className="flex flex-col gap-3" aria-label={t('tasks.title')}>
          <PeriodFilterToolbar filter={periodFilter} grains={TASK_GRAINS} />

          <section
            className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 max-[640px]:grid-cols-2"
            aria-label={t('tasks.title')}
          >
            <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t('tasks.stats.total')}
              </span>
              <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
                {stats.total}
              </strong>
            </article>
            <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t('tasks.stats.pending')}
              </span>
              <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
                {stats.pending}
              </strong>
            </article>
            <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t('tasks.stats.completed')}
              </span>
              <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                {stats.completed}
              </strong>
            </article>
            <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t('tasks.stats.overdue')}
              </span>
              <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
                {stats.overdue}
              </strong>
            </article>
          </section>

          <DataPanel
            title={t('dashboard.tasks')}
            counter={t('table.rowsCount', { count: filteredTasks.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                <div className={`flex items-center gap-1 ${MOBILE_TOOLBAR_ROW}`}>
                  <button
                    type="button"
                    className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${CHIP_PHONE} ${
                      statusFilter === 'all'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => setStatusFilter('all')}
                  >
                    {t('tasks.filter.all')}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${CHIP_PHONE} ${
                      statusFilter === 'needsAction'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => setStatusFilter('needsAction')}
                  >
                    {t('tasks.filter.needsAction')}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${CHIP_PHONE} ${
                      statusFilter === 'completed'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => setStatusFilter('completed')}
                  >
                    {t('tasks.filter.completed')}
                  </button>
                </div>
                <button
                  type="button"
                  // Compact screens get this action in the MobileActionBar instead.
                  className="inline-flex h-6 min-h-6 max-[960px]:hidden cursor-pointer items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  onClick={() => setIsCreateOpen(true)}
                >
                  + {t('tasks.actions.create')}
                </button>
                <input
                  type="search"
                  className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:h-10 max-[640px]:w-full"
                  placeholder={t('table.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
              </div>
            }
          >
            <TasksTable
              id="tasks"
              ariaLabel={t('dashboard.tasks')}
              tasks={filteredTasks}
              loading={isLoading}
              emptyMessage={t('dashboard.noTasks')}
              editingId={editingId}
              editDraft={editDraft}
              onChangeEditDraft={setEditDraft}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={setPendingDeleteId}
              isPending={updateMutation.isPending}
              showOrigin
              showReminder
              reminderChannels={reminderChannelsQuery.data}
            />
          </DataPanel>
        </section>
      )}

      <MobileActionBar>
        <button
          type="button"
          className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`}
          onClick={() => setIsCreateOpen(true)}
        >
          + {t('tasks.actions.create')}
        </button>
      </MobileActionBar>

      <CreateTaskDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          // A new task is open; show it even if the list was filtered to completed ones.
          if (statusFilter === 'completed') setStatusFilter('needsAction');
          showToast(t('tasks.create.success'));
        }}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t('tasks.delete.title')}
        message={t('tasks.delete.message')}
        confirmLabel={t('tasks.actions.delete')}
        isPending={deleteMutation.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
