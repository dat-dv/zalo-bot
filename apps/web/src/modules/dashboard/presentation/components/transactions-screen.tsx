'use client';

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import {
  TransactionsTable,
  type TransactionEditDraft,
  type TransactionFilterOptions,
  type TransactionTableItem,
} from './transactions-table';
import {
  countActiveColumnFilters,
  EMPTY_TRANSACTION_COLUMN_FILTERS,
  parseTransactionColumnFilters,
  toTransactionListFilterQuery,
  writeTransactionColumnFilters,
  type TransactionColumnFilters,
} from './transaction-column-filters';
import { DebtAllocationModal } from './debt-allocation-modal';
import { DeleteTransactionModal } from './delete-transaction-modal';
import { AdjustBalanceModal } from './adjust-balance-modal';
import { usePeriodFilter } from '@/shared/hooks/use-period-filter';
import { PeriodFilterToolbar } from '@/shared/ui/period-filter-toolbar';
import { TrendSummaryStrip } from '@/shared/ui/trend-summary-strip';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { useCategoriesQuery } from '@/modules/settings/api/categories-query';
import { usePlacesQuery } from '../../api/places-query';
import {
  useDeleteTransactionMutation,
  useTransactionsInfiniteQuery,
  useUpdateTransactionMutation,
} from '../../api/transactions-query';
import { TOAST_POSITION } from '@/shared/ui/touch';

const SEARCH_DEBOUNCE_MS = 300;

export function TransactionsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  const periodFilter = usePeriodFilter('month');

  // The URL is the source of truth for column filters, so reload and shared links keep them.
  const columnFilters = useMemo(() => parseTransactionColumnFilters(searchParams), [searchParams]);
  const activeFilter = columnFilters.type;
  const activeColumnFilterCount = countActiveColumnFilters(columnFilters);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allocatingTransaction, setAllocatingTransaction] = useState<TransactionTableItem | null>(
    null,
  );
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionTableItem | null>(null);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<TransactionEditDraft>({
    type: 'expense',
    category: '',
    note: '',
    amount: '',
    placeName: '',
    occurredAt: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Filtering happens on the server; the 'all' grain sends no date bounds.
  const listQuery = useMemo(
    () => ({
      ...toTransactionListFilterQuery(columnFilters),
      startAt: periodFilter.grain === 'all' ? undefined : periodFilter.startDate.toISOString(),
      endAt: periodFilter.grain === 'all' ? undefined : periodFilter.endDate.toISOString(),
      search: debouncedSearch || undefined,
    }),
    [
      columnFilters,
      periodFilter.grain,
      periodFilter.startDate,
      periodFilter.endDate,
      debouncedSearch,
    ],
  );
  const transactionsQuery = useTransactionsInfiniteQuery(listQuery);
  const categoriesQuery = useCategoriesQuery();
  const placesQuery = usePlacesQuery();
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();

  const setColumnFilters = useCallback(
    (next: TransactionColumnFilters) => {
      const query = writeTransactionColumnFilters(
        new URLSearchParams(searchParams.toString()),
        next,
      ).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const setFilter = useCallback(
    (type: TransactionColumnFilters['type']) => setColumnFilters({ ...columnFilters, type }),
    [columnFilters, setColumnFilters],
  );
  const clearColumnFilters = useCallback(
    () =>
      setColumnFilters({
        ...EMPTY_TRANSACTION_COLUMN_FILTERS,
        type: columnFilters.type,
      }),
    [columnFilters.type, setColumnFilters],
  );

  const pages = transactionsQuery.data?.pages;
  // runningBalance comes from the server and reflects the whole ledger, not just the loaded rows.
  const rawList = useMemo<TransactionTableItem[]>(
    () => (pages ?? []).flatMap((page) => page.items),
    [pages],
  );
  const firstPage = pages?.[0];
  const totalRows = firstPage?.total ?? 0;
  const ledgerBalance = firstPage?.ledgerBalance ?? 0;

  const configuredCategories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const placeSuggestions = useMemo(
    () => (placesQuery.data ?? []).map((place) => place.name),
    [placesQuery.data],
  );
  const filterFacets = firstPage?.facets;
  const filterOptions = useMemo<TransactionFilterOptions>(
    () => ({
      categories: filterFacets?.categories ?? [],
      places: (placesQuery.data ?? []).map((place) => ({ id: place.id, name: place.name })),
      creators: filterFacets?.creators ?? [],
    }),
    [filterFacets, placesQuery.data],
  );

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    configuredCategories
      .filter((c) => !editDraft.type || c.type === editDraft.type)
      .forEach((c) => set.add(c.name));
    rawList.forEach((item) => {
      if (item.category && (!editDraft.type || item.type === editDraft.type)) {
        set.add(item.category);
      }
    });
    const defaults =
      editDraft.type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    defaults.forEach((cat) => set.add(cat));
    return Array.from(set).sort();
  }, [configuredCategories, rawList, editDraft.type]);

  // Totals are exact for the whole period (server summary); chart buckets use the loaded rows.
  const periodIncome = firstPage?.summary.income ?? 0;
  const periodExpense = firstPage?.summary.expense ?? 0;
  const periodBuckets = useMemo(
    () => periodFilter.generateBuckets(rawList),
    [rawList, periodFilter],
  );

  const maxAmount = useMemo(() => {
    return Math.max(...rawList.map((t) => t.amount), 1);
  }, [rawList]);

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message);
      setTimeout(() => {
        startTransition(() => {
          setToastMessage(null);
        });
      }, 3000);
    },
    [startTransition],
  );

  const handleStartEdit = useCallback((item: TransactionTableItem) => {
    setEditingId(item.id);
    setEditDraft({
      type: item.type,
      category: item.category,
      note: item.note || '',
      amount: String(item.amount),
      placeName: item.placeName || '',
      occurredAt: item.occurredAt ? item.occurredAt.slice(0, 16) : '',
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft({
      type: 'expense',
      category: '',
      note: '',
      amount: '',
      placeName: '',
      occurredAt: '',
    });
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const trimmedCategory = editDraft.category.trim();
      const trimmedNote = editDraft.note.trim();
      const parsedAmount = Number(editDraft.amount);

      if (!trimmedCategory || !trimmedNote || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return;
      }

      try {
        await updateMutation.mutateAsync({
          id,
          data: {
            type: editDraft.type,
            category: trimmedCategory,
            note: trimmedNote,
            amount: parsedAmount,
            placeId: editDraft.placeName.trim() ? undefined : null,
            placeName: editDraft.placeName.trim() || undefined,
            occurredAt: editDraft.occurredAt
              ? new Date(editDraft.occurredAt).toISOString()
              : undefined,
          },
        });
        setEditingId(null);
        showToast(t('transactions.inlineEdit.saved'));
      } catch {
        // Error handled by mutation
      }
    },
    [editDraft, updateMutation, showToast, t],
  );

  const handleOpenDelete = useCallback(
    (id: string) => {
      const target = rawList.find((item) => item.id === id);
      if (target) {
        setDeletingTransaction(target);
      }
    },
    [rawList],
  );

  const handleConfirmDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        setDeletingTransaction(null);
        showToast(t('transactions.delete.success'));
      } catch {
        // Error handled by mutation
      }
    },
    [deleteMutation, showToast, t],
  );

  const handleCloseAllocate = useCallback(() => {
    setAllocatingTransaction(null);
  }, []);

  const handleAllocateSuccess = useCallback(() => {
    showToast(t('transactions.allocation.success'));
  }, [showToast, t]);

  if (transactionsQuery.isError) {
    return <SessionStateScreen reason="expired" onRetry={() => void transactionsQuery.refetch()} />;
  }

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

      <section
        className="flex flex-col gap-3 max-[640px]:gap-2"
        aria-label={t('transactions.title')}
      >
        <PeriodFilterToolbar filter={periodFilter} />

        <TrendSummaryStrip buckets={periodBuckets} income={periodIncome} expense={periodExpense} />

        <DataPanel
          title={t('transactions.title')}
          counter={
            rawList.length < totalRows
              ? t('table.loadedOf', { loaded: rawList.length, total: totalRows })
              : t('table.rowsCount', { count: totalRows })
          }
          toolbar={
            <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
              {/* Phones: one horizontally scrolling chip row instead of one row per chip. */}
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:flex-nowrap max-[640px]:overflow-x-auto">
                <button
                  type="button"
                  className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px] rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                    activeFilter === 'all'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setFilter('all')}
                >
                  {t('table.filter.all')}
                </button>
                <button
                  type="button"
                  className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px] rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                    activeFilter === 'income'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setFilter('income')}
                >
                  {t('table.filter.income')}
                </button>
                <button
                  type="button"
                  className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px] rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
                    activeFilter === 'expense'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setFilter('expense')}
                >
                  {t('table.filter.expense')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdjustBalanceOpen(true)}
                  // Rarely used, so it stays in the chip row on compact screens instead of a pinned bottom bar.
                  className="inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px] gap-1 rounded-[3px] border border-indigo-300 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/60"
                >
                  <span>⚖️</span>
                  {t('transactions.balanceAdjust.actionButton')}
                </button>
                {activeColumnFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearColumnFilters}
                    className="inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center whitespace-nowrap max-[640px]:h-10 max-[640px]:px-3 max-[640px]:text-[12.5px] gap-1 rounded-[3px] border border-sky-300 bg-sky-50 px-2 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
                  >
                    {t('table.columnFilter.clearAll')}
                    <span className="rounded-[2px] bg-sky-600 px-1.5 text-[10px] leading-4 font-semibold text-white dark:bg-sky-500">
                      {activeColumnFilterCount}
                    </span>
                  </button>
                )}
              </div>
              <input
                type="search"
                className="h-6 min-h-6 w-44 max-[640px]:h-10 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
                placeholder={t('table.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t('table.searchPlaceholder')}
              />
            </div>
          }
        >
          <TransactionsTable
            id="transactions"
            ariaLabel={t('transactions.title')}
            transactions={rawList}
            loading={transactionsQuery.isLoading}
            emptyMessage={t('dashboard.noTransactions')}
            maxAmount={maxAmount}
            editingId={editingId}
            editDraft={editDraft}
            onChangeEditDraft={setEditDraft}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
            onDelete={handleOpenDelete}
            onOpenAllocate={setAllocatingTransaction}
            categorySuggestions={categorySuggestions}
            placeSuggestions={placeSuggestions}
            isPending={updateMutation.isPending}
            columnFilters={columnFilters}
            onChangeColumnFilters={setColumnFilters}
            filterOptions={filterOptions}
          />
          {transactionsQuery.hasNextPage && (
            <div className="flex justify-center border-t border-slate-200 py-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => void transactionsQuery.fetchNextPage()}
                disabled={transactionsQuery.isFetchingNextPage}
                className="inline-flex h-7 min-h-7 max-[640px]:h-10 cursor-pointer items-center rounded-[3px] border border-slate-300 bg-white px-3 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('table.loadMore')}
              </button>
            </div>
          )}
        </DataPanel>
      </section>

      <DebtAllocationModal
        isOpen={Boolean(allocatingTransaction)}
        transaction={allocatingTransaction}
        onClose={handleCloseAllocate}
        onSuccess={handleAllocateSuccess}
      />

      <DeleteTransactionModal
        isOpen={Boolean(deletingTransaction)}
        transaction={deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        onConfirm={handleConfirmDelete}
        isPending={deleteMutation.isPending}
      />

      <AdjustBalanceModal
        isOpen={isAdjustBalanceOpen}
        currentBalance={ledgerBalance}
        onClose={() => setIsAdjustBalanceOpen(false)}
        onSuccess={(msg) => msg && showToast(msg)}
      />
    </>
  );
}
