import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  localeTag,
  TRANSACTION_FILTER_NO_PLACE,
  type ITransactionCreatorFacet,
  type TransactionType,
  type ITransactionItem,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { CategoryAutocomplete } from '@/shared/ui/category-autocomplete';
import {
  describeTransactionSource,
  ReceiptCell,
  ReceiptColumnHeader,
  ReceiptImage,
} from './transaction-receipt';
import {
  ChoiceFilter,
  ColumnFilterHeader,
  OptionsFilter,
  RangeFilter,
  TextFilter,
} from './column-filter-popover';
import {
  EMPTY_TRANSACTION_COLUMN_FILTERS,
  type ReceiptFilter,
  type TransactionColumnFilters,
} from './transaction-column-filters';

export type TransactionTableItem = ITransactionItem & {
  runningBalance?: number;
};

export type TransactionEditDraft = {
  type: TransactionType;
  category: string;
  note: string;
  placeName: string;
  amount: string;
  occurredAt: string;
};

export type TransactionsTableProps = {
  id?: string;
  transactions: TransactionTableItem[];
  ariaLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  maxAmount?: number;
  editingId?: string | null;
  editDraft?: TransactionEditDraft;
  categorySuggestions?: string[];
  placeSuggestions?: string[];
  onStartEdit?: (item: TransactionTableItem) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onOpenAllocate?: (item: TransactionTableItem) => void;
  onChangeEditDraft?: React.Dispatch<React.SetStateAction<TransactionEditDraft>>;
  isPending?: boolean;
  extraHeaderActions?: ReactNode;
  /** Server-side column filters; header filter buttons render only when `onChangeColumnFilters` is set. */
  columnFilters?: TransactionColumnFilters;
  onChangeColumnFilters?: (next: TransactionColumnFilters) => void;
  filterOptions?: TransactionFilterOptions;
  /** Phone-width list rows with a detail sheet instead of the scrolling table. */
  mobileList?: boolean;
  /** Link to a transaction's change history; set only for admins, who can read the log. */
  historyHref?: (transactionId: string) => string;
};

export type TransactionFilterOptions = {
  categories: string[];
  places: Array<{ id: string; name: string }>;
  creators: ITransactionCreatorFacet[];
};

const EMPTY_FILTER_OPTIONS: TransactionFilterOptions = { categories: [], places: [], creators: [] };

export function TransactionsTable({
  id = 'transactions-table',
  transactions,
  ariaLabel,
  emptyMessage,
  loading = false,
  maxAmount,
  editingId,
  editDraft,
  categorySuggestions = [],
  placeSuggestions = [],
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onOpenAllocate,
  onChangeEditDraft,
  isPending = false,
  columnFilters = EMPTY_TRANSACTION_COLUMN_FILTERS,
  onChangeColumnFilters,
  filterOptions = EMPTY_FILTER_OPTIONS,
  mobileList = true,
  historyHref,
}: TransactionsTableProps) {
  const { locale, t } = useLocale();
  const { money, isMoneyVisible } = useMoneyVisibility();
  const [expandedAllocationIds, setExpandedAllocationIds] = useState<Set<string>>(new Set());
  // Not persisted: every page load starts with icons only, so receipts are fetched on demand.
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  const computedMaxAmount = useMemo(() => {
    if (typeof maxAmount === 'number' && maxAmount > 0) return maxAmount;
    return Math.max(...transactions.map((item) => item.amount), 1);
  }, [maxAmount, transactions]);

  const columns = useMemo<DataTableColumn<TransactionTableItem>[]>(() => {
    const hasActions = Boolean(onStartEdit || onSaveEdit || onDelete || onOpenAllocate);
    const date = (value: string) =>
      new Intl.DateTimeFormat(localeTag(locale), {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value));
    const shortDate = (value: string) =>
      new Intl.DateTimeFormat(localeTag(locale), { day: '2-digit', month: '2-digit' }).format(
        new Date(value),
      );

    const filters = columnFilters;
    const setFilters = onChangeColumnFilters;
    const patch = (next: Partial<TransactionColumnFilters>) =>
      setFilters?.({ ...filters, ...next });
    /** Header with a filter button when filtering is enabled, else the plain label. */
    const filterHeader = (
      label: string,
      active: boolean,
      clear: Partial<TransactionColumnFilters>,
      body: ReactNode,
      align: 'left' | 'right' = 'left',
    ): ReactNode =>
      setFilters ? (
        <ColumnFilterHeader
          label={label}
          active={active}
          onClear={() => patch(clear)}
          align={align}
        >
          {body}
        </ColumnFilterHeader>
      ) : (
        label
      );

    const list: DataTableColumn<TransactionTableItem>[] = [
      {
        id: 'type',
        label: t('dashboard.columns.direction'),
        header: filterHeader(
          t('dashboard.columns.direction'),
          filters.type !== 'all',
          { type: 'all' },
          <ChoiceFilter
            name="transactions-filter-type"
            value={filters.type}
            onChange={(type) => patch({ type })}
            options={[
              { value: 'all', label: t('table.filter.all') },
              { value: 'income', label: t('table.filter.income') },
              { value: 'expense', label: t('table.filter.expense') },
            ]}
          />,
        ),
        minWidth: '90px',
        mobileHeader: Boolean(setFilters),
        cell: (item) => {
          if (editingId === item.id && editDraft && onChangeEditDraft) {
            return (
              <select
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 max-[640px]:h-10 bg-white px-1 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.type}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({
                    ...prev,
                    type: e.target.value as TransactionType,
                  }))
                }
                aria-label={t('dashboard.columns.direction')}
              >
                <option value="income">{t('table.filter.income')}</option>
                <option value="expense">{t('table.filter.expense')}</option>
              </select>
            );
          }
          return (
            <span
              className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
                onStartEdit ? 'cursor-pointer' : ''
              } ${
                item.type === 'income'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              {item.type === 'income' ? t('table.filter.income') : t('table.filter.expense')}
            </span>
          );
        },
      },
      {
        id: 'category',
        label: t('dashboard.columns.category'),
        header: filterHeader(
          t('dashboard.columns.category'),
          filters.categories.length > 0,
          { categories: [] },
          <OptionsFilter
            options={filterOptions.categories.map((name) => ({ value: name, label: name }))}
            selected={filters.categories}
            onChange={(categories) => patch({ categories })}
          />,
        ),
        minWidth: '150px',
        hideable: false,
        mobileSlot: 'secondary',
        mobileCell: (item) => item.category,
        mobileHeader: Boolean(setFilters),
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <CategoryAutocomplete
                ariaLabel={t('dashboard.columns.category')}
                autoFocus
                value={editDraft.category}
                onChange={(category: string) =>
                  onChangeEditDraft((prev) => ({ ...prev, category }))
                }
                onConfirm={() => void onSaveEdit(item.id)}
                onCancel={onCancelEdit}
                options={categorySuggestions}
                placeholder={t('transactions.placeholder.category')}
              />
            );
          }
          return (
            <span
              className={`font-semibold text-slate-900 select-none dark:text-slate-100 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.category}
            >
              {item.category}
            </span>
          );
        },
      },
      {
        id: 'note',
        label: t('dashboard.columns.note'),
        header: filterHeader(
          t('dashboard.columns.note'),
          filters.note.trim() !== '',
          { note: '' },
          <TextFilter value={filters.note} onChange={(note) => patch({ note })} />,
        ),
        minWidth: '160px',
        mobileSlot: 'primary',
        mobileCell: (item) => item.note || '—',
        mobileHeader: Boolean(setFilters),
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
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 max-[640px]:h-10 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.note}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, note: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('transactions.placeholder.note')}
                required
                aria-label={t('dashboard.columns.note')}
              />
            );
          }
          const allocationCount = item.allocations?.length || 0;
          const isExpanded = expandedAllocationIds.has(item.id);
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                // The mobile list sheet always shows the details, so the toggle is desktop-only there.
                className={`inline-flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100 ${
                  mobileList ? 'max-[960px]:hidden' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAllocationIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                }}
                title={t('transactions.details.title')}
                aria-label={t('transactions.details.title')}
                aria-expanded={isExpanded}
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
              <span
                className={`text-slate-500 select-none dark:text-slate-400 ${
                  onStartEdit ? 'cursor-pointer' : ''
                }`}
                onDoubleClick={() => onStartEdit?.(item)}
                title={item.note || undefined}
              >
                {item.note || '—'}
              </span>
              {allocationCount > 0 && onOpenAllocate && (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] border border-sky-200 bg-sky-50 px-1 py-0.5 text-[10px] font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 max-[640px]:min-h-10 max-[640px]:px-2.5 max-[640px]:text-[12px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAllocate(item);
                  }}
                  title={t('transactions.allocation.badgeAllocated', { count: allocationCount })}
                >
                  <span aria-hidden="true">🔗</span>
                  <span>
                    {t('transactions.allocation.badgeAllocated', { count: allocationCount })}
                  </span>
                </button>
              )}
            </div>
          );
        },
      },
      {
        id: 'place',
        label: t('dashboard.columns.place'),
        header: filterHeader(
          t('dashboard.columns.place'),
          filters.placeIds.length > 0,
          { placeIds: [] },
          <OptionsFilter
            options={[
              { value: TRANSACTION_FILTER_NO_PLACE, label: t('table.columnFilter.noPlace') },
              ...filterOptions.places.map((place) => ({ value: place.id, label: place.name })),
            ]}
            selected={filters.placeIds}
            onChange={(placeIds) => patch({ placeIds })}
          />,
        ),
        minWidth: '170px',
        mobileSlot: 'secondary',
        mobileCell: (item) => item.placeName || null,
        mobileHeader: Boolean(setFilters),
        cell: (item) => {
          if (
            editingId === item.id &&
            editDraft &&
            onChangeEditDraft &&
            onSaveEdit &&
            onCancelEdit
          ) {
            return (
              <CategoryAutocomplete
                ariaLabel={t('dashboard.columns.place')}
                value={editDraft.placeName}
                onChange={(placeName: string) =>
                  onChangeEditDraft((prev) => ({ ...prev, placeName }))
                }
                onConfirm={() => void onSaveEdit(item.id)}
                onCancel={onCancelEdit}
                options={placeSuggestions}
                placeholder={t('transactions.placeholder.place')}
              />
            );
          }
          return (
            <span
              className={`text-slate-500 select-none dark:text-slate-400 ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
              title={item.placeName || undefined}
            >
              {item.placeName || '—'}
            </span>
          );
        },
      },
      {
        id: 'createdBy',
        label: t('dashboard.columns.createdBy'),
        header: filterHeader(
          t('dashboard.columns.createdBy'),
          filters.createdByUserIds.length > 0,
          { createdByUserIds: [] },
          <OptionsFilter
            options={filterOptions.creators.map((creator) => ({
              value: creator.id,
              label:
                creator.name ||
                t('table.columnFilter.unknownCreator', { suffix: creator.id.slice(-4) }),
            }))}
            selected={filters.createdByUserIds}
            onChange={(createdByUserIds) => patch({ createdByUserIds })}
          />,
        ),
        minWidth: '150px',
        mobileSlot: 'secondary',
        mobileCell: (item) => item.createdByName || describeTransactionSource(item, t) || null,
        mobileHeader: Boolean(setFilters),
        cell: (item) => {
          const source = describeTransactionSource(item, t);
          if (!item.createdByName && !source) {
            return <span className="text-slate-400 select-none dark:text-slate-500">—</span>;
          }
          return (
            <div className="flex min-w-0 flex-col leading-tight">
              <span
                className="truncate font-medium text-slate-800 dark:text-slate-200"
                title={item.createdByName || undefined}
              >
                {item.createdByName || '—'}
              </span>
              {source && (
                <span
                  className="truncate text-[10.5px] text-slate-500 dark:text-slate-400"
                  title={source}
                >
                  {source}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'receipt',
        header: (
          <span className="inline-flex items-center gap-1">
            <ReceiptColumnHeader
              showPreview={showReceiptPreview}
              onToggle={() => setShowReceiptPreview((prev) => !prev)}
            />
            {setFilters && (
              <ColumnFilterHeader
                label={t('dashboard.columns.receipt')}
                hideLabel
                active={filters.receipt !== 'any'}
                onClear={() => patch({ receipt: 'any' })}
              >
                <ChoiceFilter<ReceiptFilter>
                  name="transactions-filter-receipt"
                  value={filters.receipt}
                  onChange={(receipt) => patch({ receipt })}
                  options={[
                    { value: 'any', label: t('table.columnFilter.any') },
                    { value: 'yes', label: t('table.columnFilter.hasReceipt') },
                    { value: 'no', label: t('table.columnFilter.noReceipt') },
                  ]}
                />
              </ColumnFilterHeader>
            )}
          </span>
        ),
        label: t('dashboard.columns.receipt'),
        mobileHeader: Boolean(setFilters),
        minWidth: showReceiptPreview ? '112px' : onChangeColumnFilters ? '96px' : '72px',
        cell: (item) => <ReceiptCell item={item} showPreview={showReceiptPreview} />,
      },
      {
        id: 'amount',
        label: t('dashboard.columns.amount'),
        header: filterHeader(
          t('dashboard.columns.amount'),
          filters.amountMin !== '' || filters.amountMax !== '',
          { amountMin: '', amountMax: '' },
          <RangeFilter
            min={filters.amountMin}
            max={filters.amountMax}
            onChange={({ min, max }) => patch({ amountMin: min, amountMax: max })}
          />,
          'right',
        ),
        align: 'right',
        minWidth: '140px',
        hideable: false,
        mobileSlot: 'trailing',
        // No ratio bar in the list row: the amount alone keeps the row to two lines.
        mobileCell: (item) => (
          <span
            className={
              item.type === 'income'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }
          >
            {item.type === 'income' ? '+' : '-'} {money(item.amount)}
          </span>
        ),
        mobileHeader: Boolean(setFilters),
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
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 max-[640px]:h-10 bg-white px-1.5 text-right text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.amount}
                onChange={(e) => onChangeEditDraft((prev) => ({ ...prev, amount: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSaveEdit(item.id);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                placeholder={t('transactions.placeholder.amount')}
                min="0"
                required
                aria-label={t('dashboard.columns.amount')}
              />
            );
          }
          const pct = Math.min(Math.round((item.amount / computedMaxAmount) * 100), 100);
          return (
            <div
              className={`flex flex-col items-end gap-1 select-none ${
                onStartEdit ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => onStartEdit?.(item)}
            >
              <strong
                className={`tabular-nums ${
                  item.type === 'income'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {item.type === 'income' ? '+' : '-'} {money(item.amount)}
              </strong>
              {/* The ratio bar would leak relative amounts, so it only shows when amounts are revealed. */}
              {isMoneyVisible && (
                <div className="h-1 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      item.type === 'income' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'runningBalance',
        header: t('dashboard.columns.runningBalance'),
        align: 'right',
        minWidth: '140px',
        cell: (item) => {
          if (typeof item.runningBalance !== 'number') {
            return <span className="text-slate-400 select-none dark:text-slate-500">—</span>;
          }
          const isPos = item.runningBalance >= 0;
          return (
            <span
              className={`tabular-nums font-semibold select-none ${
                isPos ? 'text-violet-700 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {money(item.runningBalance)}
            </span>
          );
        },
      },
      {
        id: 'occurredAt',
        header: t('dashboard.columns.date'),
        align: 'right',
        minWidth: '150px',
        mobileSlot: 'secondary',
        mobileCell: (item) => shortDate(item.occurredAt),
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
                className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 max-[640px]:h-10 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                value={editDraft.occurredAt}
                onChange={(e) =>
                  onChangeEditDraft((prev) => ({ ...prev, occurredAt: e.target.value }))
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
              {date(item.occurredAt)}
            </span>
          );
        },
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
            const itemAllocatedSum = (item.allocations || []).reduce(
              (sum: number, a: { amount: number }) => sum + Number(a.amount || 0),
              0,
            );
            const enteredAmount = Number(editDraft.amount) || 0;
            const isTypeChangedWithAllocations =
              itemAllocatedSum > 0 && editDraft.type !== item.type;
            const isAmountBelowAllocations =
              itemAllocatedSum > 0 && enteredAmount < itemAllocatedSum;
            const isSaveDisabled =
              isPending ||
              !editDraft.category.trim() ||
              !editDraft.note.trim() ||
              enteredAmount <= 0 ||
              isTypeChangedWithAllocations ||
              isAmountBelowAllocations;

            const saveButtonTitle = isTypeChangedWithAllocations
              ? t('transactions.allocation.cannotChangeTypeWithAllocations')
              : isAmountBelowAllocations
                ? t('transactions.allocation.cannotReduceBelowAllocated', {
                    amount: money(itemAllocatedSum),
                  })
                : t('transactions.actions.save');

            return (
              <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                {onOpenAllocate && (
                  <button
                    type="button"
                    className="inline-flex h-[22px] min-h-[22px] shrink-0 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] cursor-pointer items-center gap-1 rounded-[2px] border border-sky-200 bg-sky-50 px-1.5 text-[11px] font-medium text-sky-700 whitespace-nowrap transition-colors hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400 dark:hover:bg-sky-950/70"
                    onClick={() => onOpenAllocate(item)}
                    title={t('transactions.actions.allocateDebts')}
                    aria-label={t('transactions.actions.allocateDebts')}
                  >
                    <span aria-hidden="true">🔗</span>
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] cursor-pointer items-center rounded-[2px] border border-slate-900 bg-slate-900 px-1.5 text-[11px] font-semibold text-white whitespace-nowrap transition-colors hover:bg-slate-800 disabled:opacity-50 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
                  onClick={() => void onSaveEdit(item.id)}
                  disabled={isSaveDisabled}
                  title={saveButtonTitle}
                >
                  ✓ {t('transactions.actions.save')}
                </button>
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={onCancelEdit}
                  disabled={isPending}
                  title={t('transactions.actions.cancel')}
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
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] cursor-pointer items-center rounded-[2px] border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() => onStartEdit(item)}
                  title={t('transactions.actions.edit')}
                >
                  {t('transactions.actions.edit')}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="inline-flex h-[22px] min-h-[22px] shrink-0 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[13px] cursor-pointer items-center rounded-[2px] border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-medium text-rose-700 whitespace-nowrap transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/70"
                  onClick={() => void onDelete(item.id)}
                  title={t('transactions.actions.delete')}
                >
                  {t('transactions.actions.delete')}
                </button>
              )}
            </div>
          );
        },
      });
    }

    return list;
  }, [
    computedMaxAmount,
    editDraft,
    editingId,
    expandedAllocationIds,
    isMoneyVisible,
    isPending,
    locale,
    money,
    onCancelEdit,
    onChangeEditDraft,
    onDelete,
    onOpenAllocate,
    onSaveEdit,
    onStartEdit,
    categorySuggestions,
    placeSuggestions,
    showReceiptPreview,
    columnFilters,
    onChangeColumnFilters,
    filterOptions,
    mobileList,
    t,
  ]);

  const formatDateTime = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(value))
      : '—';

  // Master-Detail sub-panel: full transaction details, receipt image, then allocations.
  const renderExpandedRow = (item: TransactionTableItem) => {
    const source = describeTransactionSource(item, t);
    const details: Array<[string, string]> = [
      [t('transactions.details.createdBy'), item.createdByName || '—'],
      [t('transactions.details.source'), source || '—'],
      [t('transactions.details.createdAt'), formatDateTime(item.createdAt)],
      [t('transactions.details.paymentMethod'), item.paymentMethod || '—'],
      [t('transactions.details.currency'), item.currency || 'VND'],
    ];
    const hasAllocations = Boolean(item.allocations && item.allocations.length > 0);

    return (
      <div className="space-y-2 py-2 pl-12 pr-4 max-sm:pl-3 max-sm:pr-2">
        <section
          aria-label={t('transactions.details.title')}
          className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-3 shadow-xs sm:flex-row dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="min-w-0 break-words font-medium text-slate-800 dark:text-slate-200">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="text-xs">
              <div className="text-slate-500 dark:text-slate-400">
                {t('transactions.details.note')}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
                {item.note || '—'}
              </p>
            </div>
            {historyHref && (
              <Link
                href={historyHref(item.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline max-[640px]:min-h-10 dark:text-sky-400"
              >
                {t('transactions.details.history')}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
          {item.hasReceipt && (
            <div className="shrink-0 sm:w-56">
              <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                {t('transactions.receipt.title')}
              </div>
              <ReceiptImage
                transactionId={item.id}
                alt={t('transactions.receipt.title')}
                className="max-h-72 w-full rounded border border-slate-200 object-contain dark:border-slate-700"
              />
            </div>
          )}
        </section>
        {hasAllocations && item.allocations && (
          <div className="overflow-hidden rounded border border-sky-200/80 bg-sky-50/20 shadow-xs dark:border-sky-900/60 dark:bg-sky-950/20">
            <header className="flex items-center justify-between border-b border-sky-100/80 bg-sky-50/50 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">🔗</span>
                <span>
                  {t('transactions.allocation.badgeAllocated', { count: item.allocations.length })}
                </span>
              </div>
              {onOpenAllocate && (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] border border-sky-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-sky-700 transition-colors hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800 max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12px]"
                  onClick={() => onOpenAllocate(item)}
                >
                  <span aria-hidden="true">✏️</span>
                  <span>{t('transactions.allocation.editAllocations')}</span>
                </button>
              )}
            </header>
            {/* Phones: one row per allocation instead of a sideways-scrolling table. */}
            <ul className="m-0 hidden list-none divide-y divide-sky-100/60 p-0 text-xs max-[640px]:block dark:divide-sky-900/40">
              {item.allocations.map((alloc, idx: number) => (
                <li
                  key={alloc.id || idx}
                  className="flex min-h-[52px] flex-col justify-center gap-0.5 px-3 py-2"
                >
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">
                      {alloc.counterparty || t('transactions.badge.allocatedChild')}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                      {money(alloc.amount)}
                    </span>
                  </span>
                  {alloc.note && (
                    <span className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                      {alloc.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto max-[640px]:hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sky-200/50 bg-sky-100/30 text-[10.5px] font-semibold uppercase tracking-wider text-sky-800 dark:border-sky-800/40 dark:bg-sky-900/30 dark:text-sky-300">
                    <th scope="col" className="w-10 px-2.5 py-1 text-right">
                      #
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('dashboard.columns.counterparty')}
                    </th>
                    <th scope="col" className="px-2.5 py-1 text-right">
                      {t('dashboard.columns.amount')}
                    </th>
                    <th scope="col" className="px-2.5 py-1">
                      {t('dashboard.columns.note')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/60 dark:divide-sky-900/40">
                  {item.allocations.map((alloc, idx: number) => (
                    <tr
                      key={alloc.id || idx}
                      className="transition-colors hover:bg-sky-100/20 dark:hover:bg-sky-900/20"
                    >
                      <td className="px-2.5 py-1.5 text-right font-mono text-sky-700/60 dark:text-sky-400/60">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200">
                        {alloc.counterparty || t('transactions.badge.allocatedChild')}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                        {money(alloc.amount)}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300">
                        {alloc.note || '—'}
                      </td>
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
      ariaLabel={ariaLabel ?? t('dashboard.transactions')}
      rows={transactions}
      emptyMessage={emptyMessage ?? t('dashboard.noTransactions')}
      columns={columns}
      getRowKey={(item) => item.id}
      isRowExpanded={(item) => expandedAllocationIds.has(item.id)}
      renderExpandedRow={renderExpandedRow}
      disableSorting
      loading={loading}
      mobileList={mobileList}
    />
  );
}
