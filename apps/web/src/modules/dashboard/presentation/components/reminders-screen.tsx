'use client';

import { useCallback, useState, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  type IReminderListItem,
  type IUpdateReminderRequest,
  type ReminderListStatus,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import { RemindersTable, type ReminderEditDraft } from './reminders-table';
import { reminderApiErrorMessage } from '@/modules/reminders/api/reminder-targets-api';
import { useReminderTargetChannelsQuery } from '@/modules/reminders/api/reminder-targets-query';
import {
  REMINDER_TARGET_ERROR_MESSAGES,
  buildReminderTargetFields,
  emptyReminderTargetDraft,
  isTargetChanged,
  reminderTargetDraftFrom,
  type ReminderTargetError,
} from '@/modules/reminders/model/reminder-target';
import {
  buildReminderTimes,
  isReminderTimesChanged,
  reminderTimeDraftsFrom,
  snoozeReminderTimes,
} from '@/modules/reminders/model/reminder-times';
import {
  REMINDER_RULE_ERROR_MESSAGES,
  buildNagFields,
  emptyNagDraft,
  isNagChanged,
  nagDraftFrom,
  reminderRuleError,
} from '@/modules/reminders/model/reminder-nag';
import {
  reminderListStatusFrom,
  writeReminderListStatus,
} from '@/modules/reminders/model/reminder-list-status';
import {
  remindersQueryKeys,
  useDeleteReminderMutation,
  useRemindersQuery,
  useUpdateReminderMutation,
} from '@/modules/reminders/api/reminders-query';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';
import {
  MOBILE_TOOLBAR_ROW,
  PHONE_CHIP,
  PHONE_TOOLBAR_INPUT,
  TOAST_POSITION,
} from '@/shared/ui/touch';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import { CreateReminderDialog } from './create-reminder-dialog';

const CHIP_PHONE = `max-[640px]:shrink-0 max-[640px]:whitespace-nowrap ${PHONE_CHIP}`;
const STATUS_TABS: ReadonlyArray<{
  status: ReminderListStatus;
  label: 'reminders.tab.upcoming' | 'reminders.tab.done';
}> = [
  { status: 'upcoming', label: 'reminders.tab.upcoming' },
  { status: 'done', label: 'reminders.tab.done' },
];

const emptyEditDraft = (): ReminderEditDraft => ({
  title: '',
  remindTimes: reminderTimeDraftsFrom(undefined),
  notifyType: 'text',
  nag: emptyNagDraft(),
  target: emptyReminderTargetDraft(),
});

export function RemindersScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  // The tab lives in the URL, so a reload or a shared link opens the same list.
  const status = reminderListStatusFrom(searchParams);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ReminderEditDraft>(emptyEditDraft);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dashboard = useDashboardQuery();
  const remindersQuery = useRemindersQuery(status);
  const updateMutation = useUpdateReminderMutation();
  const deleteMutation = useDeleteReminderMutation();
  const targetChannelsQuery = useReminderTargetChannelsQuery(editingId !== null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.all() });
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
  };

  const rawList = useMemo(() => {
    if (remindersQuery.data && remindersQuery.data.length > 0) {
      return remindersQuery.data;
    }
    // The Home payload only has upcoming reminders, so the Done tab never falls back to it.
    if (status === 'done') return remindersQuery.data ?? [];
    return dashboard.data?.reminders ?? [];
  }, [remindersQuery.data, dashboard.data?.reminders, status]);

  const setStatus = useCallback(
    (next: ReminderListStatus) => {
      setEditingId(null);
      const query = writeReminderListStatus(
        new URLSearchParams(searchParams.toString()),
        next,
      ).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

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
      // Saved times (shown in the browser's time zone); a list from the Home payload has none.
      remindTimes: item.remindTimes
        ? reminderTimeDraftsFrom(item.remindTimes)
        : reminderTimeDraftsFrom([
            { id: item.id, remindAt: item.remindAt, repeatType: item.repeatType },
          ]),
      notifyType: item.notifyType || 'text',
      nag: nagDraftFrom(item),
      target: reminderTargetDraftFrom(item.remindUsers, item.remindMode),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyEditDraft());
  };

  /** Target fields of the PATCH, sent only when the chat, people or mode were edited. */
  const targetPatch = (
    item: IReminderListItem | undefined,
  ): { ok: true; patch: IUpdateReminderRequest } | { ok: false; error: ReminderTargetError } => {
    const saved = { chatId: item?.chatId, users: item?.remindUsers, mode: item?.remindMode };
    if (!isTargetChanged(editDraft.target, saved)) return { ok: true, patch: {} };
    const target = buildReminderTargetFields(
      editDraft.target,
      targetChannelsQuery.data ?? [],
      item?.chatId,
    );
    if (!target.ok) return target;
    return {
      ok: true,
      patch: {
        chatId: target.fields.chatId,
        remindUserIds: target.fields.remindUserIds,
        remindMode: target.fields.remindMode,
      },
    };
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedTitle = editDraft.title.trim();
    if (!trimmedTitle) return;
    const item = remindersQuery.data?.find((reminder) => reminder.id === id);
    const target = targetPatch(item);
    if (!target.ok) {
      showToast(t(REMINDER_TARGET_ERROR_MESSAGES[target.error]));
      return;
    }
    // Unchanged saved times go back as they are, so a time already sent never blocks saving.
    const times = buildReminderTimes(editDraft.remindTimes);
    if (!times.ok || times.iso.length === 0) {
      showToast(t('reminders.create.pastTime'));
      return;
    }
    const nag = buildNagFields(editDraft.nag);
    const ruleError = reminderRuleError(times.times, nag);
    if (ruleError) {
      showToast(t(REMINDER_RULE_ERROR_MESSAGES[ruleError]));
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: trimmedTitle,
          // A list from the Home payload has no times to compare: always send them.
          ...(!item?.remindTimes || isReminderTimesChanged(times.times, item.remindTimes)
            ? { remindTimes: times.times }
            : {}),
          notifyType: editDraft.notifyType,
          ...(isNagChanged(editDraft.nag, item ?? {}) ? nag : {}),
          ...target.patch,
        },
      });
      setEditingId(null);
      showToast(t('reminders.inlineEdit.saved'));
    } catch (err: unknown) {
      // The API explains a rejected target (chat not listened, a call to a group...).
      showToast(reminderApiErrorMessage(err, t('reminders.create.error')));
    }
  };

  const handleSnooze = async (item: IReminderListItem) => {
    try {
      // Only the next time not sent moves; the other times of the reminder stay.
      const data: IUpdateReminderRequest = item.remindTimes?.length
        ? { remindTimes: snoozeReminderTimes(item.remindTimes, 15) }
        : { remindAt: new Date(Date.parse(item.remindAt) + 15 * 60 * 1000).toISOString() };
      await updateMutation.mutateAsync({ id: item.id, data });
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
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                <div
                  className={`flex items-center gap-1 ${MOBILE_TOOLBAR_ROW}`}
                  role="group"
                  aria-label={t('reminders.tabs')}
                >
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.status}
                      type="button"
                      aria-pressed={status === tab.status}
                      className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${CHIP_PHONE} ${
                        status === tab.status
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setStatus(tab.status)}
                    >
                      {t(tab.label)}
                    </button>
                  ))}
                </div>
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
                  className={`h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${PHONE_TOOLBAR_INPUT}`}
                  placeholder={t('table.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
              </div>
            }
          >
            <RemindersTable
              // Each tab has its own columns (Done adds "Done at"), so it gets its own table:
              // a fresh column state and its own saved column choices.
              key={status}
              id={status === 'done' ? 'reminders-done' : 'reminders'}
              ariaLabel={t('dashboard.reminders')}
              reminders={filteredReminders}
              loading={isLoading}
              emptyMessage={t(status === 'done' ? 'reminders.noDone' : 'dashboard.noReminders')}
              editingId={editingId}
              editDraft={editDraft}
              onChangeEditDraft={setEditDraft}
              showTarget
              showCompletedAt={status === 'done'}
              targetChannels={targetChannelsQuery.data}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              // A finished reminder has no next time to snooze; editing its times reopens it.
              onSnooze={status === 'done' ? undefined : handleSnooze}
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
