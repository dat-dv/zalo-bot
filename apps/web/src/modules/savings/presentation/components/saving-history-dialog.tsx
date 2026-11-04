'use client';

import { useId, useState } from 'react';
import { localeTag, type ISavingGroup, type ISavingMovement } from '@zalobot/contracts';
import { apiErrorText } from '@/modules/zca/model/channel-memory';
import { useLocale } from '@/shared/providers/locale-provider';
import { useSavingsMoney } from '@/shared/store/savings-visibility-store';
import { SavingsVisibilityToggle } from '@/shared/ui/savings-visibility-toggle';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { MODAL_CLOSE_TAP, MODAL_STICKY_HEADER, Modal } from '@/shared/ui/modal';
import { useDeleteSavingMovementMutation, useSavingMovementsQuery } from '../../api/savings-query';

interface SavingHistoryDialogProps {
  group: ISavingGroup;
  onClose: () => void;
  onDeleted: (message: string) => void;
}

export function SavingHistoryDialog({ group, onClose, onDeleted }: SavingHistoryDialogProps) {
  const { locale, t } = useLocale();
  const money = useSavingsMoney();
  const titleId = useId();
  const movements = useSavingMovementsQuery(group.id);
  const deleteMutation = useDeleteSavingMovementMutation();
  const [deleting, setDeleting] = useState<ISavingMovement | null>(null);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(localeTag(locale), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(
      { groupId: group.id, movementId: deleting.id },
      {
        onSuccess: () => {
          setDeleting(null);
          onDeleted(t('savings.toast.movementDeleted'));
        },
        // Keeps the dialog's list while the reason shows above it.
        onError: () => setDeleting(null),
      },
    );
  };

  const columns: DataTableColumn<ISavingMovement>[] = [
    {
      id: 'occurredAt',
      header: t('savings.columns.date'),
      minWidth: '120px',
      mobileSlot: 'secondary',
      mobileCell: (item) => formatDate(item.occurredAt),
      cell: (item) => formatDate(item.occurredAt),
    },
    {
      id: 'type',
      header: t('savings.columns.type'),
      minWidth: '100px',
      hideable: false,
      mobileSlot: 'primary',
      mobileCell: (item) => t(`savings.movement.type.${item.type}`),
      cell: (item) => t(`savings.movement.type.${item.type}`),
    },
    {
      id: 'amount',
      header: t('savings.columns.amount'),
      align: 'right',
      minWidth: '110px',
      mobileSlot: 'trailing',
      mobileCell: (item) => money(item.amount),
      cell: (item) => <span className="tabular-nums">{money(item.amount)}</span>,
    },
    {
      id: 'note',
      header: t('savings.columns.note'),
      minWidth: '130px',
      cell: (item) => item.note || '—',
    },
    {
      id: 'createdBy',
      header: t('savings.columns.createdBy'),
      minWidth: '100px',
      cell: (item) => item.createdByName || '—',
    },
    {
      id: 'actions',
      header: t('savings.columns.action'),
      align: 'right',
      minWidth: '70px',
      hideable: false,
      cell: (item) =>
        group.archivedAt ? null : (
          <button
            type="button"
            className={`inline-flex h-[22px] min-h-[22px] items-center rounded-[2px] border px-1.5 text-[11px] font-medium max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] ${BUTTON_TONE.dangerSoft}`}
            onClick={() => setDeleting(item)}
          >
            {t('savings.actions.delete')}
          </button>
        ),
    },
  ];

  return (
    <>
      <Modal
        open
        onDismiss={onClose}
        labelledBy={titleId}
        phoneLayout="fullscreen"
        panelClassName="max-w-3xl rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <header
          className={`${MODAL_STICKY_HEADER} flex items-center gap-2 border-b border-slate-200 bg-white py-1 pr-1 pl-3 dark:border-slate-800 dark:bg-slate-900 max-sm:pt-3`}
        >
          <h2
            id={titleId}
            className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {t('savings.history.title', { name: group.name })}
          </h2>
          {/* Behind this dialog the page's eye cannot be reached. */}
          <SavingsVisibilityToggle />
          <button
            type="button"
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] border-0 text-lg ${BUTTON_TONE.ghost} ${MODAL_CLOSE_TAP}`}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </header>
        {deleteMutation.error && (
          <p
            role="alert"
            className="m-3 mb-0 rounded-[3px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          >
            {apiErrorText(deleteMutation.error, t('savings.error.generic'))}
          </p>
        )}
        <div className="p-3">
          <DataTable
            id="saving-movements"
            tableName="saving_movements"
            entityName="saving_movements"
            ariaLabel={t('savings.history.title', { name: group.name })}
            rows={movements.data ?? []}
            columns={columns}
            emptyMessage={t(movements.isError ? 'savings.error.load' : 'savings.noMovements')}
            getRowKey={(item) => item.id}
            loading={movements.isLoading}
            allowColumnToggle={false}
          />
        </div>
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title={t('savings.deleteMovement.title')}
        message={
          deleting
            ? t('savings.deleteMovement.message', {
                type: t(`savings.movement.type.${deleting.type}`),
                amount: money(deleting.amount),
              })
            : ''
        }
        confirmLabel={t('savings.actions.delete')}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
