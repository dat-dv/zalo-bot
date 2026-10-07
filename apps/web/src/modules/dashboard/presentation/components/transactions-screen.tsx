'use client';

import { useState, useMemo, useCallback, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  type TransactionType,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import {
  TransactionsTable,
  type TransactionEditDraft,
  type TransactionTableItem,
} from './transactions-table';
import { DebtAllocationModal } from './debt-allocation-modal';
import { DeleteTransactionModal } from './delete-transaction-modal';
import { AdjustBalanceModal } from './adjust-balance-modal';
import { usePeriodFilter } from '@/shared/hooks/use-period-filter';
import { PeriodFilterToolbar } from '@/shared/ui/period-filter-toolbar';
import { TrendSummaryStrip } from '@/shared/ui/trend-summary-strip';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { useDashboardQuery } from '../../api/dashboard-query';
import { useCategoriesQuery } from '@/modules/settings/api/categories-query';
import { usePlacesQuery } from '../../api/places-query';
import {
  useDeleteTransactionMutation,
  useUpdateTransactionMutation,
} from '../../api/transactions-query';

type FilterType = 'all' | TransactionType;

export function TransactionsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  const periodFilter = usePeriodFilter('month');

  const currentTypeParam = searchParams.get('type');
  const activeFilter: FilterType =
    currentTypeParam === 'income' || currentTypeParam === 'expense' ? currentTypeParam : 'all';

  const [search, setSearch] = useState('');
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

  const dashboard = useDashboardQuery();
  const categoriesQuery = useCategoriesQuery();
  const placesQuery = usePlacesQuery();
  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();

  const setFilter = useCallback(
    (type: FilterType) => {
      const params = new URLSearchParams(searchParams.toString());
      if (type === 'all') {
        params.delete('type');
      } else {
        params.set('type', type);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const rawList = useMemo<TransactionTableItem[]>(() => {
    const list = dashboard.data?.transactions ?? [];
    if (!list.length) return [];

    // Sort chronologically ascending to calculate running balance
    const sortedAsc = [...list].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    let running = 0;
    const balanceMap = new Map<string, number>();
    for (const item of sortedAsc) {
      if (item.type === 'income') {
        running += item.amount;
      } else {
        running -= item.amount;
      }
      balanceMap.set(item.id, running);
    }

    return list.map((item) => ({
      ...item,
      runningBalance: balanceMap.get(item.id) ?? 0,
    }));
  }, [dashboard.data?.transactions]);

  const configuredCategories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const placeSuggestions = useMemo(
    () => (placesQuery.data ?? []).map((place) => place.name),
    [placesQuery.data],
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

  const periodTransactions = useMemo(() => {
    return rawList.filter((item) => periodFilter.isItemInPeriod(item.occurredAt));
  }, [rawList, periodFilter]);

  const { periodIncome, periodExpense, periodBuckets } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const item of periodTransactions) {
      if (item.type === 'income') {
        income += item.amount;
      } else {
        expense += item.amount;
      }
    }
    const buckets = periodFilter.generateBuckets(periodTransactions);
    return {
      periodIncome: income,
      periodExpense: expense,
      periodBuckets: buckets,
    };
  }, [periodTransactions, periodFilter]);

  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter((item) => {
      if (activeFilter !== 'all' && item.type !== activeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.category.toLowerCase().includes(q) ||
        (item.note?.toLowerCase().includes(q) ?? false) ||
        (item.placeName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [periodTransactions, activeFilter, search]);

  const maxAmount = useMemo(() => {
    return Math.max(...periodTransactions.map((t) => t.amount), 1);
  }, [periodTransactions]);

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

  if (dashboard.isError) {
    return <SessionStateScreen reason="expired" onRetry={() => void dashboard.refetch()} />;
  }

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 rounded bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {toastMessage}
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label={t('transactions.title')}>
        <PeriodFilterToolbar filter={periodFilter} />

        <TrendSummaryStrip buckets={periodBuckets} income={periodIncome} expense={periodExpense} />

        <DataPanel
          title={t('transactions.title')}
          counter={t('table.rowsCount', { count: filteredTransactions.length })}
          toolbar={
            <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
              <button
                type="button"
                className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
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
                className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
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
                className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium transition-colors ${
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
                className="inline-flex h-6 min-h-6 cursor-pointer items-center gap-1 rounded-[3px] border border-indigo-300 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/60"
              >
                <span>⚖️</span>
                {t('transactions.balanceAdjust.actionButton')}
              </button>
              <input
                type="search"
                className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
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
            transactions={filteredTransactions}
            loading={dashboard.isLoading}
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
          />
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
        currentBalance={dashboard.data?.finance.balance ?? 0}
        onClose={() => setIsAdjustBalanceOpen(false)}
        onSuccess={(msg) => msg && showToast(msg)}
      />
    </>
  );
}
