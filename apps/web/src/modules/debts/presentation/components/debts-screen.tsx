'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type IDebtListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/store/money-visibility-store';
import { DataPanel } from '@/shared/ui/data-table';
import { DebtsTable, type DebtEditDraft, getDebtStatus } from './debts-table';
import { CombineDebtsDialog } from './combine-debts-dialog';
import { CreateDebtDialog } from './create-debt-dialog';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { MOBILE_ACTION_BUTTON, MobileActionBar } from '@/shared/ui/mobile-action-bar';
import { MOBILE_TOOLBAR_ROW, TAP_CONTROL, TAP_INPUT, TOAST_POSITION } from '@/shared/ui/touch';

import { useContactsQuery } from '@/modules/contacts/api/contacts-query';
import {
  debtsQueryKeys,
  useCreateDebtPaymentMutation,
  useDeleteDebtMutation,
  useDeleteDebtPaymentMutation,
  useDebtsQuery,
  useUpdateDebtMutation,
} from '../../api/debts-query';
import { matchContact } from '../../model/debt-create-form';

/** Toolbar chip sizing at phone width (40px tall), matching the Transactions toolbar. */
const PHONE_CHIP = 'max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px]';
const CONTACTS_DATALIST_ID = 'debt-contacts-autocomplete';

type DirectionFilter = 'all' | 'receivable' | 'payable';
type StatusFilter = 'all' | 'active' | 'settled';

export function DebtsScreen() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCombineOpen, setIsCombineOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IDebtListItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DebtEditDraft>({
    direction: 'receivable',
    counterparty: '',
    counterpartyAlias: '',
    contactId: '',
    originalAmount: '',
    remainingAmount: '',
    note: '',
    dueAt: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const debts = useDebtsQuery();
  const contactsQuery = useContactsQuery();
  const updateMutation = useUpdateDebtMutation();
  const paymentMutation = useCreateDebtPaymentMutation();
  const deletePaymentMutation = useDeleteDebtPaymentMutation();
  const deleteMutation = useDeleteDebtMutation();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
    void queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  const rawList = useMemo(() => debts.data ?? [], [debts.data]);
  const contactsList = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);

  const stats = useMemo(() => {
    const rootDebts = rawList.filter((d) => !d.parentDebtId);
    let active = 0;
    let settled = 0;
    for (const d of rootDebts) {
      if (getDebtStatus(d) === 'settled') {
        settled++;
      } else {
        active++;
      }
    }
    return {
      total: rootDebts.length,
      active,
      settled,
    };
  }, [rawList]);

  const totalReceivable = useMemo(
    () =>
      rawList
        .filter(
          (d) => !d.parentDebtId && d.direction === 'receivable' && getDebtStatus(d) === 'active',
        )
        .reduce((sum, d) => sum + d.remainingAmount, 0),
    [rawList],
  );
  const totalPayable = useMemo(
    () =>
      rawList
        .filter(
          (d) => !d.parentDebtId && d.direction === 'payable' && getDebtStatus(d) === 'active',
        )
        .reduce((sum, d) => sum + d.remainingAmount, 0),
    [rawList],
  );

  const filteredDebts = useMemo(() => {
    return rawList.filter((item) => {
      if (directionFilter !== 'all' && item.direction !== directionFilter) return false;
      if (statusFilter !== 'all' && getDebtStatus(item) !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchesSelf =
        item.counterparty.toLowerCase().includes(q) ||
        (item.counterpartyAlias && item.counterpartyAlias.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q));
      if (matchesSelf) return true;
      if (
        item.children &&
        item.children.some(
          (c) =>
            c.counterparty.toLowerCase().includes(q) ||
            (c.counterpartyAlias && c.counterpartyAlias.toLowerCase().includes(q)) ||
            (c.note && c.note.toLowerCase().includes(q)),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [rawList, directionFilter, statusFilter, search]);

  const money = useMoneyFormatter();

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const handleStartEdit = (item: IDebtListItem) => {
    setEditingId(item.id);
    setEditDraft({
      direction: item.direction,
      counterparty: item.counterparty,
      counterpartyAlias: item.counterpartyAlias || '',
      contactId: item.contactId || '',
      originalAmount: String(item.originalAmount),
      remainingAmount: String(item.remainingAmount),
      note: item.note || '',
      dueAt: item.dueAt ? item.dueAt.slice(0, 10) : '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft({
      direction: 'receivable',
      counterparty: '',
      counterpartyAlias: '',
      contactId: '',
      originalAmount: '',
      remainingAmount: '',
      note: '',
      dueAt: '',
    });
  };

  const handleCounterpartyChange = (val: string) => {
    const matched = matchContact(contactsList, val);
    if (matched) {
      setEditDraft((prev) => ({
        ...prev,
        counterparty: matched.displayName,
        counterpartyAlias: matched.alias || '',
        contactId: matched.id,
      }));
    } else {
      setEditDraft((prev) => ({
        ...prev,
        counterparty: val,
        contactId: '',
        counterpartyAlias: '',
      }));
    }
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedCounterparty = editDraft.counterparty.trim();
    const parsedOriginal = Number(editDraft.originalAmount);
    const parsedRemaining = Number(editDraft.remainingAmount);

    if (
      !trimmedCounterparty ||
      Number.isNaN(parsedOriginal) ||
      parsedOriginal < 0 ||
      Number.isNaN(parsedRemaining) ||
      parsedRemaining < 0
    ) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          direction: editDraft.direction,
          counterparty: trimmedCounterparty,
          counterpartyAlias: editDraft.counterpartyAlias || undefined,
          contactId: editDraft.contactId || undefined,
          originalAmount: parsedOriginal,
          remainingAmount: parsedRemaining,
          note: editDraft.note.trim() || undefined,
          dueAt: editDraft.dueAt
            ? new Date(`${editDraft.dueAt}T23:59:59.000Z`).toISOString()
            : undefined,
        },
      });
      setEditingId(null);
      showToast(t('debts.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleQuickSettle = async (item: IDebtListItem) => {
    if (item.remainingAmount <= 0) return;
    try {
      await paymentMutation.mutateAsync({
        debtId: item.id,
        amount: item.remainingAmount,
        note: t('debts.actions.repay'),
      });
      showToast(t('debts.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeletePayment = async (debtId: string, paymentId: string) => {
    if (!window.confirm(t('debts.deletePayment.confirm'))) return;
    try {
      await deletePaymentMutation.mutateAsync({ debtId, paymentId });
      showToast(t('debts.deletePayment.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = (id: string) => {
    const target = rawList.find((d) => d.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (editingId === id) handleCancelEdit();
      showToast(t('debts.delete.success'));
    } catch (err: unknown) {
      showToast(err instanceof Error && err.message ? err.message : t('debts.delete.error'));
    } finally {
      setDeleteTarget(null);
    }
  };

  const deleteMessage = useMemo(() => {
    if (!deleteTarget) return '';
    const name = deleteTarget.counterpartyAlias
      ? `${deleteTarget.counterparty} (${deleteTarget.counterpartyAlias})`
      : deleteTarget.counterparty;
    const paymentCount = deleteTarget.payments?.length ?? 0;
    const childCount = deleteTarget.childCount ?? deleteTarget.children?.length ?? 0;
    return [
      t('debts.delete.message', { name, amount: money(deleteTarget.originalAmount) }),
      paymentCount > 0 ? t('debts.delete.paymentsWarning', { count: paymentCount }) : '',
      childCount > 0 ? t('debts.delete.childrenWarning', { count: childCount }) : '',
    ]
      .filter(Boolean)
      .join(' ');
  }, [deleteTarget, money, t]);

  const filteredRootDebts = useMemo(
    () => filteredDebts.filter((d) => !d.parentDebtId),
    [filteredDebts],
  );

  const selectedDebts = useMemo(
    () => rawList.filter((d) => selectedIds.has(d.id)),
    [rawList, selectedIds],
  );

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredRootDebts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRootDebts.map((d) => d.id)));
    }
  };

  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredRootDebts.length;

  return (
    <div className="flex flex-col gap-3">
      {toastMessage && (
        <div
          role="status"
          className={`${TOAST_POSITION} rounded bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900`}
        >
          {toastMessage}
        </div>
      )}

      {isCombineOpen && (
        <CombineDebtsDialog
          isOpen={isCombineOpen}
          selectedDebts={selectedDebts}
          onClose={() => setIsCombineOpen(false)}
          onSuccess={(count) => {
            setSelectedIds(new Set());
            showToast(t('debts.combine.success', { count }));
            refresh();
          }}
        />
      )}

      <CreateDebtDialog
        open={isCreateOpen}
        contacts={contactsList}
        contactsListId={CONTACTS_DATALIST_ID}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          showToast(t('debts.create.success'));
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('debts.delete.title')}
        message={deleteMessage}
        confirmLabel={t('debts.actions.delete')}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      {contactsList.length > 0 && (
        <datalist id={CONTACTS_DATALIST_ID}>
          {contactsList.map((contact) => (
            <option
              key={contact.id}
              value={contact.displayName}
              label={contact.alias ? `${contact.displayName} (${contact.alias})` : undefined}
            />
          ))}
        </datalist>
      )}

      <section
        className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 max-[640px]:grid-cols-2"
        aria-label={t('debts.stats.receivable')}
      >
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('debts.stats.receivable')}
          </span>
          <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
            {money(totalReceivable)}
          </strong>
        </article>
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('debts.stats.payable')}
          </span>
          <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
            {money(totalPayable)}
          </strong>
        </article>
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('debts.stats.activeCount')}
          </span>
          <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
            {stats.active} / {stats.total}
          </strong>
        </article>
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('debts.stats.settledCount')}
          </span>
          <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
            {stats.settled}
          </strong>
        </article>
      </section>

      {debts.isError ? (
        <section
          className="flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          role="alert"
        >
          <strong>{t('dashboard.error.title')}</strong>
          <button
            type="button"
            className={`cursor-pointer rounded-[2px] bg-rose-600 px-2 py-0.5 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 ${TAP_CONTROL}`}
            onClick={refresh}
          >
            {t('common.retry')}
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-3" aria-label={t('debts.title')}>
          <DataPanel
            title={t('debts.title')}
            counter={t('table.rowsCount', { count: filteredRootDebts.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                {/* Phones: every chip shares one sideways-scrolling row; desktop layout is untouched. */}
                <div
                  className={`contents max-[640px]:flex max-[640px]:items-center max-[640px]:gap-1.5 ${MOBILE_TOOLBAR_ROW}`}
                >
                  <button
                    type="button"
                    // Compact screens get this action in the MobileActionBar instead.
                    className="inline-flex h-6 min-h-6 max-[960px]:hidden cursor-pointer items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    + {t('debts.actions.create')}
                  </button>
                  {selectedIds.size >= 2 && (
                    <button
                      type="button"
                      className="inline-flex h-6 min-h-6 items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-2 max-[960px]:hidden text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      onClick={() => setIsCombineOpen(true)}
                    >
                      {t('debts.actions.combine', { count: selectedIds.size })}
                    </button>
                  )}
                  {filteredRootDebts.length > 0 && (
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} max-[640px]:order-last ${
                        selectedIds.size === filteredRootDebts.length
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={handleToggleSelectAll}
                    >
                      {selectedIds.size === filteredRootDebts.length
                        ? t('debts.deselectAll')
                        : t('debts.selectAll')}
                    </button>
                  )}
                  {isPartiallySelected && (
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-[3px] border border-sky-500 bg-sky-50 px-2 ${PHONE_CHIP} max-[640px]:order-last text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50`}
                      onClick={() => setSelectedIds(new Set())}
                      title={t('debts.deselectAll')}
                    >
                      {t('debts.selectedCount', { count: selectedIds.size })} ✕
                    </button>
                  )}

                  <div className="flex items-center gap-1 max-[640px]:contents">
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
                        statusFilter === 'all'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setStatusFilter('all')}
                    >
                      {t('debts.filter.allStatus')}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
                        statusFilter === 'active'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setStatusFilter('active')}
                    >
                      {t('debts.status.active')}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
                        statusFilter === 'settled'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setStatusFilter('settled')}
                    >
                      {t('debts.status.settled')}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 max-[640px]:contents">
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
                        directionFilter === 'all'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setDirectionFilter('all')}
                    >
                      {t('debts.filter.allDirections')}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
                        directionFilter === 'receivable'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setDirectionFilter('receivable')}
                    >
                      {t('table.filter.receivable')}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
                        directionFilter === 'payable'
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => setDirectionFilter('payable')}
                    >
                      {t('table.filter.payable')}
                    </button>
                  </div>
                </div>
                <input
                  type="search"
                  className={`h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${TAP_INPUT}`}
                  placeholder={t('table.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
              </div>
            }
          >
            <DebtsTable
              id="debts"
              ariaLabel={t('debts.title')}
              debts={filteredDebts}
              loading={debts.isLoading}
              emptyMessage={t('dashboard.noDebts')}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              editingId={editingId}
              editDraft={editDraft}
              onChangeEditDraft={setEditDraft}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onQuickSettle={handleQuickSettle}
              onDelete={handleDelete}
              onDeletePayment={handleDeletePayment}
              onCounterpartyChange={handleCounterpartyChange}
              isPending={
                updateMutation.isPending ||
                paymentMutation.isPending ||
                deletePaymentMutation.isPending
              }
            />
          </DataPanel>
        </section>
      )}

      <MobileActionBar>
        {selectedIds.size >= 2 ? (
          <button
            type="button"
            className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`}
            onClick={() => setIsCombineOpen(true)}
          >
            {t('debts.actions.combine', { count: selectedIds.size })}
          </button>
        ) : (
          <button
            type="button"
            className={`${MOBILE_ACTION_BUTTON} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`}
            onClick={() => setIsCreateOpen(true)}
          >
            + {t('debts.actions.create')}
          </button>
        )}
      </MobileActionBar>
    </div>
  );
}
