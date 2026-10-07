import { useCallback, useMemo, useState } from 'react';
import { localeTag, type IDebtListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';

export type DebtTableItem = IDebtListItem;

export type DebtEditDraft = {
  direction: 'receivable' | 'payable';
  counterparty: string;
  counterpartyAlias: string;
  contactId: string;
  originalAmount: string;
  remainingAmount: string;
  note: string;
  dueAt: string;
};

export type DebtsTableProps = {
  id?: string;
  debts: IDebtListItem[];
  ariaLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  editingId?: string | null;
  editDraft?: DebtEditDraft;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onStartEdit?: (item: IDebtListItem) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (id: string) => void | Promise<void>;
  onQuickSettle?: (item: IDebtListItem) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onDeletePayment?: (debtId: string, paymentId: string) => void | Promise<void>;
  onCounterpartyChange?: (val: string) => void;
  onChangeEditDraft?: React.Dispatch<React.SetStateAction<DebtEditDraft>>;
  isPending?: boolean;
};

export function getDebtStatus(item: IDebtListItem): 'active' | 'settled' {
  if (item.status) return item.status;
  return item.remainingAmount === 0 || item.settledAt ? 'settled' : 'active';
}

export function DebtsTable({
  id = 'debts-table',
  debts,
  ariaLabel,
  emptyMessage,
  loading = false,
  editingId,
  editDraft,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onQuickSettle,
  onDelete,
  onDeletePayment,
  onCounterpartyChange,
  onChangeEditDraft,
  isPending = false,
}: DebtsTableProps) {
  const { locale, t } = useLocale();
  const money = useMoneyFormatter();
  const [expandedDebtIds, setExpandedDebtIds] = useState<Set<string>>(new Set());

  // Only display root level debts in main table to prevent STT numbering pollution
  const rootRows = useMemo<IDebtListItem[]>(() => {
    const roots = debts.filter((d) => !d.parentDebtId);
    return roots.length > 0 ? roots : debts;
  }, [debts]);

  const date = useCallback(
    (value?: string) =>
      value
        ? new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'short' }).format(new Date(value))
        : '',
    [locale],
  );

  const columns = useMemo<DataTableColumn<IDebtListItem>[]>(() => {
    const hasActions = Boolean(onStartEdit || onSaveEdit || onQuickSettle || onDelete);

    const list: DataTableColumn<IDebtListItem>[] = [];

    if (onToggleSelect && selectedIds) {
      list.push({
        id: 'select',
        header: (
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950"
            checked={rootRows.length > 0 && selectedIds.size === rootRows.length}
            onChange={() => onToggleSelectAll?.()}
            aria-label={t('debts.selectAll')}
          />
        ),
        minWidth: 40,
        width: 40,
        hideable: false,
        cell: (item) => (
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950"
            checked={selectedIds.has(item.id)}
            onChange={() => onToggleSelect(item.id)}
            aria-label={item.counterparty}
          />
        ),
      });
    }

    list.push(
      {
        id: 'status',
        header: t('debts.columns.status'),
        minWidth: '100px',
        width: 100,
        hideable: false,
        cell: (item) => {
          const status = getDebtStatus(item);
          return (
            <span
              className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
                status === 'settled'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {status === 'settled' ? t('debts.status.settled') : t('debts.status.active')}
            </span>
          );
        },
      },
      {
        id: 'direction',
        header: t('dashboard.columns.direction'),
        minWidth: '100px',
        cell: (item) => {
          if (editingId === item.id && editDraft && onChangeEditDraft) {
            return (
              <select
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.direction}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({
                    ...prev,
                    direction: e.target.value as 'receivable' | 'payable',
                  }))
                }
                aria-label={t('dashboard.columns.direction')}
              >
                <option value="receivable">{t('table.filter.receivable')}</option>
                <option value="payable">{t('table.filter.payable')}</option>
              </select>
            );
          }
          return (
            <span
              className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
                onStartEdit ? 'cursor-pointer' : ''
              } ${
                item.direction === 'receivable'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {item.direction === 'receivable'
                ? t('table.filter.receivable')
                : t('table.filter.payable')}
            </span>
          );
        },
      },
      {
        id: 'counterparty',
        header: t('dashboard.columns.counterparty'),
        minWidth: '200px',
        hideable: false,
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onCounterpartyChange &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <input
                type="text"
                list="debt-contacts-autocomplete"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.counterparty}
                onChange={(e) => onCounterpartyChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('debts.placeholder.counterparty')}
                autoFocus
                required
                aria-label={t('dashboard.columns.counterparty')}
              />
            );
          }

          const hasChildren = Boolean(item.children && item.children.length > 0);
          const hasPayments = Boolean(item.payments && item.payments.length > 0);
          const hasSubDetails = hasChildren || hasPayments;
          const isExpanded = expandedDebtIds.has(item.id);

          return (
            <div className="flex items-center gap-1.5">
              {/* EXACTLY 1 single dropdown toggle button */}
              {hasSubDetails && (
                <button
                  type="button"
                  className="inline-flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDebtIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    });
                  }}
                  title={isExpanded ? t('debts.collapseChildren') : t('debts.expandChildren')}
                  aria-label={isExpanded ? t('debts.collapseChildren') : t('debts.expandChildren')}
                >
                  <svg
                    className={`size-3 transition-transform duration-150 ${isExpanded ? 'rotate-90 text-sky-600 dark:text-sky-400' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}

              <span
                className={`font-semibold text-slate-900 select-none dark:text-slate-100 ${
                  onStartEdit ? 'cursor-pointer' : ''
                }`}
                onDoubleClick={() => onStartEdit?.(item)}
                title={item.counterparty}
              >
                {item.counterparty}
                {item.counterpartyAlias ? ` · ${item.counterpartyAlias}` : ''}
              </span>

              {hasChildren && (
                <span className="inline-flex items-center rounded-[2px] border border-sky-200 bg-sky-50 px-1 py-0.2 text-[9.5px] font-medium text-sky-700 select-none dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                  {t('debts.badge.parent', {
                    count: item.children?.length || 0,
                  })}
                </span>
              )}

              {!hasChildren && hasPayments && (
                <span className="inline-flex items-center rounded-[2px] border border-emerald-200 bg-emerald-50 px-1 py-0.2 text-[9.5px] font-medium text-emerald-700 select-none dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {t('debts.badge.paymentInstallment', { count: item.payments?.length ?? 0 })}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'originalAmount',
        header: t('dashboard.columns.original'),
        align: 'right',
        minWidth: '140px',
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
                type="number"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-right text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.originalAmount}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, originalAmount: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('debts.placeholder.originalAmount')}
                min="0"
                step="1000"
                required
                aria-label={t('dashboard.columns.original')}
              />
            );
          }
          return (
            <span
              className={`tabular-nums text-slate-600 select-none dark:text-slate-300 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {money(item.originalAmount)}
            </span>
          );
        },
      },
      {
        id: 'remainingAmount',
        header: t('dashboard.columns.remaining'),
        align: 'right',
        minWidth: '140px',
        hideable: false,
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
                type="number"
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-right text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.remainingAmount}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, remainingAmount: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('debts.placeholder.remainingAmount')}
                min="0"
                step="1000"
                required
                aria-label={t('dashboard.columns.remaining')}
              />
            );
          }

          const paidTotal = item.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
          const paidPct =
            item.originalAmount > 0
              ? Math.min(Math.round((paidTotal / item.originalAmount) * 100), 100)
              : 0;
          const progressTitle =
            paidTotal > 0
              ? t('debts.paidProgressWithCount', {
                  amount: money(paidTotal),
                  count: item.payments?.length ?? 0,
                })
              : undefined;

          return (
            <div
              className={`flex flex-col items-end justify-center select-none ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={progressTitle}
            >
              <strong
                className={`tabular-nums ${
                  item.remainingAmount === 0
                    ? 'font-normal text-slate-400 dark:text-slate-500'
                    : item.direction === 'receivable'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {money(item.remainingAmount)}
              </strong>
              {paidTotal > 0 && item.remainingAmount > 0 && (
                <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'currency',
        header: t('debts.columns.currency'),
        minWidth: '80px',
        cell: (item) => (
          <span className="inline-flex items-center rounded-[2px] border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 select-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {item.currency || 'VND'}
          </span>
        ),
      },
      {
        id: 'dueAt',
        header: t('dashboard.columns.dueDate'),
        minWidth: '130px',
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
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.dueAt}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, dueAt: e.target.value }))}
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
              {date(item.dueAt) || t('common.notSet')}
            </span>
          );
        },
      },
      {
        id: 'settledAt',
        header: t('debts.columns.settledAt'),
        minWidth: '120px',
        cell: (item) => (
          <span className="text-[11.5px] text-slate-500 select-none dark:text-slate-400">
            {item.settledAt ? date(item.settledAt) : '—'}
          </span>
        ),
      },
      {
        id: 'note',
        header: t('dashboard.columns.note'),
        minWidth: '150px',
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
                value={editDraft.note}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, note: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('debts.placeholder.note')}
                aria-label={t('dashboard.columns.note')}
              />
            );
          }
          return (
            <span
              className={`text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.note || undefined}
            >
              {item.note || '—'}
            </span>
          );
        },
      },
    );

    if (hasActions) {
      list.push({
        id: 'actions',
        header: t('dashboard.columns.action'),
        align: 'right',
        minWidth: '140px',
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
                  disabled={
                    isPending ||
                    !editDraft.counterparty.trim() ||
                    Number.isNaN(Number(editDraft.originalAmount)) ||
                    Number.isNaN(Number(editDraft.remainingAmount))
                  }
                  title={t('debts.actions.save')}
                >
                  ✓ {t('debts.actions.save')}
                </button>
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={onCancelEdit}
                  disabled={isPending}
                  title={t('debts.actions.cancel')}
                >
                  ✕
                </button>
              </div>
            );
          }

          const isSettled = getDebtStatus(item) === 'settled';

          return (
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
              {!isSettled && onQuickSettle && (
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-emerald-600 bg-emerald-50 px-1.5 text-[11px] font-semibold text-emerald-700 whitespace-nowrap transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                  onClick={() => void onQuickSettle(item)}
                  title={t('debts.actions.repay')}
                >
                  {t('debts.actions.repay')}
                </button>
              )}
              {onStartEdit && (
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() => onStartEdit(item)}
                  title={t('debts.actions.edit')}
                >
                  {t('debts.actions.edit')}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-medium text-rose-700 whitespace-nowrap transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/70"
                  onClick={() => void onDelete(item.id)}
                  title={t('common.cancel')}
                >
                  ✕
                </button>
              )}
            </div>
          );
        },
      });
    }

    return list;
  }, [
    date,
    editDraft,
    editingId,
    expandedDebtIds,
    isPending,
    money,
    onCancelEdit,
    onChangeEditDraft,
    onCounterpartyChange,
    onDelete,
    onQuickSettle,
    onSaveEdit,
    onStartEdit,
    onToggleSelect,
    onToggleSelectAll,
    rootRows.length,
    selectedIds,
    t,
  ]);

  // Master-Detail 1-Level Indented Sub-panel Renderer
  const renderExpandedRow = (item: IDebtListItem) => {
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const hasPayments = Boolean(item.payments && item.payments.length > 0);
    if (!hasChildren && !hasPayments) return null;

    return (
      <div className="space-y-3 py-2 pl-12 pr-4">
        {/* Combined Child Debts Table */}
        {hasChildren && item.children && (
          <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sky-600 dark:text-sky-400">↳</span>
                <span>{t('debts.badge.parent', { count: item.children.length })}</span>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                    <th scope="col" className="w-10 px-2.5 py-1 text-right">
                      #
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('dashboard.columns.counterparty')}
                    </th>
                    <th scope="col" className="px-2.5 py-1 text-right">
                      {t('dashboard.columns.original')}
                    </th>
                    <th scope="col" className="px-2.5 py-1 text-right">
                      {t('dashboard.columns.remaining')}
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('dashboard.columns.dueDate')}
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('dashboard.columns.note')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {item.children.map((child, idx) => {
                    const childPaid = child.originalAmount - child.remainingAmount;
                    const childPaidPct =
                      child.originalAmount > 0
                        ? Math.min(Math.round((childPaid / child.originalAmount) * 100), 100)
                        : 0;
                    const childProgressTitle =
                      childPaid > 0
                        ? t('debts.paidProgress', {
                            amount: money(childPaid),
                          })
                        : undefined;

                    return (
                      <tr
                        key={child.id}
                        className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                      >
                        <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200">
                          {child.counterparty}
                          {child.counterpartyAlias && (
                            <span className="ml-1 text-[10px] text-slate-400">
                              ({child.counterpartyAlias})
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {money(child.originalAmount)}
                        </td>
                        <td
                          className="px-2.5 py-1.5 text-right tabular-nums"
                          title={childProgressTitle}
                        >
                          <div className="flex flex-col items-end justify-center">
                            <span
                              className={
                                child.remainingAmount === 0
                                  ? 'font-normal text-slate-400'
                                  : 'font-semibold text-amber-700 dark:text-amber-400'
                              }
                            >
                              {money(child.remainingAmount)}
                            </span>
                            {childPaid > 0 && child.remainingAmount > 0 && (
                              <div className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${childPaidPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400">
                          {date(child.dueAt) || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400">
                          {child.note || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment History Table */}
        {hasPayments && item.payments && (
          <div className="overflow-hidden rounded border border-emerald-200/80 bg-emerald-50/20 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <header className="flex items-center justify-between border-b border-emerald-100/80 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
              <div className="flex items-center gap-1.5">
                <span>💸</span>
                <span>{t('debts.badge.paymentInstallment', { count: item.payments.length })}</span>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-emerald-200/50 bg-emerald-100/30 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <th scope="col" className="w-12 px-2.5 py-1 text-right">
                      {t('table.ordinal')}
                    </th>
                    <th scope="col" className="px-2.5 py-1 text-right">
                      {t('dashboard.columns.amount')}
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('debts.columns.settledAt')}
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('dashboard.columns.note')}
                    </th>
                    {onDeletePayment && (
                      <th scope="col" className="w-16 px-2.5 py-1 text-right">
                        {t('dashboard.columns.action')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100/60 dark:divide-emerald-900/40">
                  {item.payments.map((p, idx) => (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-emerald-100/20 dark:hover:bg-emerald-900/20"
                    >
                      <td className="px-2.5 py-1.5 text-right font-mono text-emerald-700/60 dark:text-emerald-400/60">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        - {money(p.amount)}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300">
                        {date(p.paymentDate || p.createdAt)}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300">
                        <span>{p.note || t('debts.badge.paymentChild')}</span>
                        {p.financeTransactionId && (
                          <span className="ml-2 inline-flex items-center rounded bg-sky-100 px-1 py-0.2 text-[9.5px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            🔗 {t('debts.payments.linkedTransaction')}
                          </span>
                        )}
                      </td>
                      {onDeletePayment && (
                        <td className="px-2.5 py-1.5 text-right">
                          <button
                            type="button"
                            className="inline-flex size-5 items-center justify-center rounded border border-rose-200 bg-white text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400"
                            onClick={() => void onDeletePayment(item.id, p.id)}
                            title={t('common.cancel')}
                            aria-label={t('common.cancel')}
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DataTable
      id={id}
      ariaLabel={ariaLabel ?? t('dashboard.openDebts')}
      rows={rootRows}
      emptyMessage={emptyMessage ?? t('dashboard.noDebts')}
      columns={columns}
      getRowKey={(item) => item.id}
      isRowExpanded={(item) => expandedDebtIds.has(item.id)}
      renderExpandedRow={renderExpandedRow}
      disableSorting
      loading={loading}
    />
  );
}
