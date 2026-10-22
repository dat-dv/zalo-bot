'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type IReminderListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import { RemindersTable, type ReminderEditDraft } from './reminders-table';
import {
  remindersQueryKeys,
  useDeleteReminderMutation,
  useRemindersQuery,
  useUpdateReminderMutation,
} from '@/modules/reminders/api/reminders-query';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';
import { TOAST_POSITION } from '@/shared/ui/touch';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import { CreateReminderDialog } from './create-reminder-dialog';

export function RemindersScreen() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ReminderEditDraft>({
    title: '',
    remindAt: '',
    notifyType: 'text',
    repeatType: 'none',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dashboard = useDashboardQuery();
  const remindersQuery = useRemindersQuery();
  const updateMutation = useUpdateReminderMutation();
  const deleteMutation = useDeleteReminderMutation();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.list() });
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
  };

  const rawList = useMemo(() => {
    if (remindersQuery.data && remindersQuery.data.length > 0) {
      return remindersQuery.data;
    }
    return dashboard.data?.reminders ?? [];
  }, [remindersQuery.data, dashboard.data?.reminders]);

  const filteredReminders = useMemo(() => {
    if (!search.trim()) return rawList;
    const q = search.toLowerCase();
    return rawList.filter((item) => item.title.toLowerCase().includes(q));
  }, [rawList, search]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const handleStartEdit = (item: IReminderListItem) => {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      remindAt: item.remindAt ? item.remindAt.slice(0, 16) : '',
      notifyType: item.notifyType || 'text',
      repeatType: item.repeatType || 'none',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft({
      title: '',
      remindAt: '',
      notifyType: 'text',
      repeatType: 'none',
    });
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedTitle = editDraft.title.trim();
    if (!trimmedTitle) return;

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: trimmedTitle,
          remindAt: editDraft.remindAt ? new Date(editDraft.remindAt).toISOString() : undefined,
          notifyType: editDraft.notifyType,
          repeatType: editDraft.repeatType,
        },
      });
      setEditingId(null);
      showToast(t('reminders.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleSnooze = async (item: IReminderListItem) => {
    try {
      const nextTime = new Date(new Date(item.remindAt).getTime() + 15 * 60 * 1000).toISOString();
      await updateMutation.mutateAsync({
        id: item.id,
        data: {
          remindAt: nextTime,
        },
      });
      showToast(t('reminders.snooze.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('reminders.delete.confirm'))) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast(t('reminders.delete.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = dashboard.isLoading || remindersQuery.isLoading;
  const isError = dashboard.isError || remindersQuery.isError;

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
        <section className="flex flex-col gap-3" aria-label={t('dashboard.reminders')}>
          <DataPanel
            title={t('dashboard.reminders')}
            counter={t('table.rowsCount', { count: filteredReminders.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full">
                <button
                  type="button"
                  // Compact screens get this action in the MobileActionBar instead.
                  className="inline-flex h-6 min-h-6 max-[960px]:hidden cursor-pointer items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
                  onClick={() => setIsCreateOpen(true)}
                >
                  + {t('reminders.actions.create')}
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
            <RemindersTable
              id="reminders"
              ariaLabel={t('dashboard.reminders')}
              reminders={filteredReminders}
              loading={isLoading}
              emptyMessage={t('dashboard.noReminders')}
              editingId={editingId}
              editDraft={editDraft}
              onChangeEditDraft={setEditDraft}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
              isPending={updateMutation.isPending}
            />
          </DataPanel>
        </section>
      )}

      <MobileActionBar>
        <button
          type="button"
          className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500`}
          onClick={() => setIsCreateOpen(true)}
        >
          + {t('reminders.actions.create')}
        </button>
      </MobileActionBar>

      <CreateReminderDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          showToast(t('reminders.create.success'));
        }}
      />
    </>
  );
}
