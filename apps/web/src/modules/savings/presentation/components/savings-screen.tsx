'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ISavingGroup, SavingMovementType } from '@zalobot/contracts';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { apiErrorText } from '@/modules/zca/model/channel-memory';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { MetricGrid, MetricGridSkeleton, type MetricGridItem } from '@/shared/ui/metric-grid';
import { PHONE_CHIP, TOAST_POSITION } from '@/shared/ui/touch';
import { useArchiveSavingGroupMutation, useSavingGroupsQuery } from '../../api/savings-query';
import { SavingGroupDialog } from './saving-group-dialog';
import { SavingHistoryDialog } from './saving-history-dialog';
import { SavingMovementDialog } from './saving-movement-dialog';

const ROW_ACTION = `inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px]`;

export function SavingsScreen() {
  const { t } = useLocale();
  const { money } = useMoneyVisibility();
  const savings = useSavingGroupsQuery();
  const archiveMutation = useArchiveSavingGroupMutation();
  const [showArchived, setShowArchived] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // Ids, so an open dialog always reads the group's latest balance after a refetch.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [movement, setMovement] = useState<{ groupId: string; type: SavingMovementType } | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const groups = useMemo(() => savings.data?.groups ?? [], [savings.data?.groups]);
  const visibleGroups = useMemo(
    () => (showArchived ? groups : groups.filter((group) => !group.archivedAt)),
    [groups, showArchived],
  );
  const findGroup = (id: string | null) => groups.find((group) => group.id === id);
  const editingGroup = findGroup(editingId);
  const historyGroup = findGroup(historyId);
  const archivingGroup = findGroup(archivingId);
  const movementGroup = findGroup(movement?.groupId ?? null);

  const ledgerBalance = savings.data?.ledgerBalance ?? 0;
  const savingsTotal = savings.data?.savingsTotal ?? 0;
  const metrics: MetricGridItem[] = [
    {
      label: t('savings.walletBalance'),
      value: money(ledgerBalance),
      valueClassName: 'text-sky-700 dark:text-sky-400',
    },
    {
      label: t('savings.total'),
      value: money(savingsTotal),
      valueClassName: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: t('savings.walletWithSavings'),
      value: money(ledgerBalance + savingsTotal),
      valueClassName: 'text-slate-700 dark:text-slate-300',
    },
  ];

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => setToastMessage(null));
    }, 3000);
  };

  const handleConfirmArchive = () => {
    if (!archivingId) return;
    archiveMutation.mutate(archivingId, {
      onSuccess: () => {
        setArchivingId(null);
        showToast(t('savings.toast.archived'));
      },
      onError: (error) => {
        setArchivingId(null);
        showToast(apiErrorText(error, t('savings.error.generic')));
      },
    });
  };

  const columns: DataTableColumn<ISavingGroup>[] = [
    {
      id: 'name',
      header: t('savings.columns.name'),
      minWidth: '180px',
      hideable: false,
      mobileSlot: 'primary',
      mobileCell: (item) => item.name,
      cell: (item) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {item.name}
          {item.archivedAt && (
            <span className="ml-1.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
              {t('savings.archived')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'balance',
      header: t('savings.columns.balance'),
      align: 'right',
      minWidth: '120px',
      hideable: false,
      mobileSlot: 'trailing',
      mobileCell: (item) => money(item.balance),
      cell: (item) => <span className="tabular-nums">{money(item.balance)}</span>,
    },
    {
      id: 'note',
      header: t('savings.columns.note'),
      minWidth: '160px',
      mobileSlot: 'secondary',
      mobileCell: (item) => item.note || null,
      cell: (item) => item.note || '—',
    },
    {
      id: 'movementCount',
      header: t('savings.columns.movementCount'),
      align: 'right',
      minWidth: '70px',
      cell: (item) => item.movementCount,
    },
    {
      id: 'actions',
      header: t('savings.columns.action'),
      align: 'right',
      minWidth: '330px',
      hideable: false,
      cell: (item) => (
        <div className="flex flex-nowrap items-center justify-end gap-1 max-[640px]:flex-wrap">
          {!item.archivedAt && (
            <>
              <button
                type="button"
                className={`${ROW_ACTION} ${BUTTON_TONE.primary}`}
                onClick={() => setMovement({ groupId: item.id, type: 'deposit' })}
              >
                {t('savings.actions.deposit')}
              </button>
              <button
                type="button"
                className={`${ROW_ACTION} ${BUTTON_TONE.secondary}`}
                onClick={() => setMovement({ groupId: item.id, type: 'withdrawal' })}
                disabled={item.balance <= 0}
              >
                {t('savings.actions.withdraw')}
              </button>
              <button
                type="button"
                className={`${ROW_ACTION} ${BUTTON_TONE.secondary}`}
                onClick={() => setMovement({ groupId: item.id, type: 'opening' })}
              >
                {t('savings.actions.opening')}
              </button>
            </>
          )}
          <button
            type="button"
            className={`${ROW_ACTION} ${BUTTON_TONE.secondary}`}
            onClick={() => setHistoryId(item.id)}
          >
            {t('savings.actions.history')}
          </button>
          {!item.archivedAt && (
            <>
              <button
                type="button"
                className={`${ROW_ACTION} ${BUTTON_TONE.secondary}`}
                onClick={() => setEditingId(item.id)}
              >
                {t('savings.actions.edit')}
              </button>
              <button
                type="button"
                className={`${ROW_ACTION} ${BUTTON_TONE.dangerSoft}`}
                onClick={() => setArchivingId(item.id)}
                disabled={item.balance !== 0}
                title={item.balance !== 0 ? t('savings.archive.blocked') : undefined}
              >
                {t('savings.actions.archive')}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (savings.isError) {
    return <SessionStateScreen reason="expired" onRetry={() => void savings.refetch()} />;
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

      <section className="flex flex-col gap-3 max-[640px]:gap-2" aria-label={t('savings.title')}>
        {savings.isLoading ? <MetricGridSkeleton count={3} /> : <MetricGrid items={metrics} />}

        <DataPanel
          title={t('savings.title')}
          counter={t('table.rowsCount', { count: visibleGroups.length })}
          toolbar={
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={showArchived}
                onClick={() => setShowArchived((prev) => !prev)}
                className={`inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap ${PHONE_CHIP} rounded-[3px] border px-2 text-[11px] font-medium ${
                  showArchived ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
                }`}
              >
                {t('savings.showArchived')}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className={`inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap ${PHONE_CHIP} rounded-[3px] border px-2 text-[11px] font-semibold ${BUTTON_TONE.primary}`}
              >
                {t('savings.actions.create')}
              </button>
            </div>
          }
        >
          <DataTable
            id="saving-groups"
            tableName="saving_groups"
            entityName="saving_groups"
            ariaLabel={t('savings.title')}
            rows={visibleGroups}
            columns={columns}
            emptyMessage={t('savings.noData')}
            getRowKey={(item) => item.id}
            loading={savings.isLoading}
          />
        </DataPanel>
      </section>

      {isCreating && (
        <SavingGroupDialog
          onClose={() => setIsCreating(false)}
          onSaved={(message) => {
            setIsCreating(false);
            showToast(message);
          }}
        />
      )}
      {editingGroup && (
        <SavingGroupDialog
          group={editingGroup}
          onClose={() => setEditingId(null)}
          onSaved={(message) => {
            setEditingId(null);
            showToast(message);
          }}
        />
      )}
      {movement && movementGroup && (
        <SavingMovementDialog
          group={movementGroup}
          type={movement.type}
          onClose={() => setMovement(null)}
          onSaved={(message) => {
            setMovement(null);
            showToast(message);
          }}
        />
      )}
      {historyGroup && (
        <SavingHistoryDialog
          group={historyGroup}
          onClose={() => setHistoryId(null)}
          onDeleted={showToast}
        />
      )}
      <ConfirmDialog
        open={Boolean(archivingGroup)}
        title={t('savings.archive.title')}
        message={t('savings.archive.message', { name: archivingGroup?.name ?? '' })}
        confirmLabel={t('savings.actions.archive')}
        isPending={archiveMutation.isPending}
        onCancel={() => setArchivingId(null)}
        onConfirm={handleConfirmArchive}
      />
    </>
  );
}
