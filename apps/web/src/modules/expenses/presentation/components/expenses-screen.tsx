'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localeTag, DEFAULT_EXPENSE_CATEGORIES, type IExpenseListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';

import { usePeriodFilter } from '@/shared/hooks/use-period-filter';
import { PeriodFilterToolbar } from '@/shared/ui/period-filter-toolbar';
import { TrendSummaryStrip } from '@/shared/ui/trend-summary-strip';
import { TAP_CONTROL, TAP_INPUT, TOAST_POSITION } from '@/shared/ui/touch';
import {
  expensesQueryKeys,
  useDeleteExpenseMutation,
  useExpensesQuery,
  useUpdateExpenseMutation,
} from '../../api/expenses-query';
import { useCategoriesQuery } from '@/modules/settings/api/categories-query';

export function ExpensesScreen() {
  const queryClient = useQueryClient();
  const { locale, t } = useLocale();
  const periodFilter = usePeriodFilter('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    category: string;
    note: string;
    amount: string;
    paymentMethod: string;
    occurredAt: string;
  }>({
    category: '',
    note: '',
    amount: '',
    paymentMethod: '',
    occurredAt: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const expenses = useExpensesQuery();
  const categoriesQuery = useCategoriesQuery('expense');
  const updateMutation = useUpdateExpenseMutation();
  const deleteMutation = useDeleteExpenseMutation();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: expensesQueryKeys.list() });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const rawList = useMemo(() => expenses.data ?? [], [expenses.data]);
  const configuredCategories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    configuredCategories.forEach((c) => set.add(c.name));
    rawList.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    DEFAULT_EXPENSE_CATEGORIES.forEach((cat) => set.add(cat));
    return Array.from(set).sort();
  }, [configuredCategories, rawList]);

  // Filter by period first
  const periodExpenses = useMemo(() => {
    return rawList.filter((item) => periodFilter.isItemInPeriod(item.occurredAt));
  }, [rawList, periodFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    periodExpenses.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [periodExpenses]);

  // Filter by category & search
  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.category.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q))
      );
    });
  }, [periodExpenses, selectedCategory, search]);

  const totalPeriodAmount = useMemo(
    () => periodExpenses.reduce((sum, item) => sum + item.amount, 0),
    [periodExpenses],
  );

  const maxExpenseAmount = useMemo(
    () => Math.max(...periodExpenses.map((e) => e.amount), 1),
    [periodExpenses],
  );

  const periodBuckets = useMemo(() => {
    return periodFilter.generateBuckets(
      periodExpenses.map((e) => ({
        occurredAt: e.occurredAt,
        amount: e.amount,
        type: 'expense' as const,
      })),
    );
  }, [periodExpenses, periodFilter]);

  const { money, isMoneyVisible } = useMoneyVisibility();

  const date = (value: string) =>
    new Intl.DateTimeFormat(localeTag(locale), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));

  const shortDate = (value: string) =>
    new Intl.DateTimeFormat(localeTag(locale), { day: '2-digit', month: '2-digit' }).format(
      new Date(value),
    );

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => {
        setToastMessage(null);
      });
    }, 3000);
  };

  const handleStartEdit = (item: IExpenseListItem) => {
    setEditingId(item.id);
    setEditDraft({
      category: item.category,
      note: item.note || '',
      amount: String(item.amount),
      paymentMethod: item.paymentMethod || '',
      occurredAt: item.occurredAt ? item.occurredAt.slice(0, 16) : '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft({
      category: '',
      note: '',
      amount: '',
      paymentMethod: '',
      occurredAt: '',
    });
  };

  const handleSaveEdit = async (id: string) => {
    const trimmedCategory = editDraft.category.trim();
    const parsedAmount = Number(editDraft.amount);
    if (!trimmedCategory || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          category: trimmedCategory,
          note: editDraft.note.trim() || undefined,
          amount: parsedAmount,
          paymentMethod: editDraft.paymentMethod.trim() || undefined,
          occurredAt: editDraft.occurredAt
            ? new Date(editDraft.occurredAt).toISOString()
            : undefined,
        },
      });
      setEditingId(null);
      showToast(t('expenses.inlineEdit.saved'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('expenses.delete.confirm'))) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast(t('expenses.delete.success'));
    } catch {
      // Error handled by mutation
    }
  };

  const expenseColumns: DataTableColumn<IExpenseListItem>[] = [
    {
      id: 'category',
      header: t('dashboard.columns.category'),
      minWidth: '160px',
      hideable: false,
      mobileSlot: 'secondary',
      mobileCell: (item) => item.category,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              list="expense-categories-autocomplete"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.category}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, category: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('expenses.placeholder.category')}
              autoFocus
              required
              aria-label={t('dashboard.columns.category')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer font-semibold text-slate-900 select-none dark:text-slate-100"
            onDoubleClick={() => handleStartEdit(item)}
            title={item.category}
          >
            {item.category}
          </span>
        );
      },
    },
    {
      id: 'note',
      header: t('dashboard.columns.note'),
      minWidth: '180px',
      mobileSlot: 'primary',
      mobileCell: (item) => item.note || '—',
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.note}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, note: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('expenses.placeholder.note')}
              aria-label={t('dashboard.columns.note')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer text-slate-500 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
            title={item.note}
          >
            {item.note || '—'}
          </span>
        );
      },
    },
    {
      id: 'amount',
      header: t('dashboard.columns.amount'),
      align: 'right',
      minWidth: '140px',
      hideable: false,
      mobileSlot: 'trailing',
      mobileCell: (item) => (
        <span className="text-amber-700 dark:text-amber-400">{money(item.amount)}</span>
      ),
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="number"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-right text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.amount}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, amount: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('expenses.placeholder.amount')}
              required
              aria-label={t('dashboard.columns.amount')}
            />
          );
        }
        const pct = Math.min(Math.round((item.amount / maxExpenseAmount) * 100), 100);
        return (
          <div
            className="flex cursor-pointer flex-col items-end gap-1 select-none"
            onDoubleClick={() => handleStartEdit(item)}
          >
            <strong className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {money(item.amount)}
            </strong>
            {/* The ratio bar would leak relative amounts, so it only shows when amounts are revealed. */}
            {isMoneyVisible && (
              <div className="h-1 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'paymentMethod',
      header: t('expenses.columns.paymentMethod'),
      minWidth: '120px',
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.paymentMethod}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              placeholder={t('expenses.placeholder.paymentMethod')}
              aria-label={t('expenses.columns.paymentMethod')}
            />
          );
        }
        return (
          <span
            className="inline-flex cursor-pointer items-center rounded-[2px] border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 select-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            onDoubleClick={() => handleStartEdit(item)}
          >
            {item.paymentMethod || t('common.notSet')}
          </span>
        );
      },
    },
    {
      id: 'currency',
      header: t('expenses.columns.currency'),
      minWidth: '80px',
      cell: (item) => (
        <span className="inline-flex items-center rounded-[2px] border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 select-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {item.currency || 'VND'}
        </span>
      ),
    },
    {
      id: 'occurredAt',
      header: t('dashboard.columns.date'),
      align: 'right',
      minWidth: '150px',
      mobileSlot: 'secondary',
      mobileCell: (item) => shortDate(item.occurredAt),
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="datetime-local"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editDraft.occurredAt}
              onChange={(e) => setEditDraft((prev) => ({ ...prev, occurredAt: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              aria-label={t('dashboard.columns.date')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer text-[11.5px] text-slate-500 select-none dark:text-slate-400"
            onDoubleClick={() => handleStartEdit(item)}
          >
            {date(item.occurredAt)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: t('dashboard.columns.action'),
      align: 'right',
      minWidth: '130px',
      hideable: false,
      cell: (item) => {
        const isEditing = editingId === item.id;
        if (isEditing) {
          return (
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
              <button
                type="button"
                className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-semibold whitespace-nowrap ${BUTTON_TONE.primary}`}
                onClick={() => void handleSaveEdit(item.id)}
                disabled={
                  updateMutation.isPending ||
                  !editDraft.category.trim() ||
                  !Number(editDraft.amount)
                }
                title={t('expenses.actions.save')}
              >
                ✓ {t('expenses.actions.save')}
              </button>
              <button
                type="button"
                className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.secondary}`}
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
                title={t('expenses.actions.cancel')}
              >
                ✕
              </button>
            </div>
          );
        }
        return (
          <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
            <button
              type="button"
              className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.secondary}`}
              onClick={() => handleStartEdit(item)}
              title={t('expenses.actions.edit')}
            >
              ✎ {t('expenses.actions.edit')}
            </button>
            <button
              type="button"
              className={`inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] font-medium whitespace-nowrap ${BUTTON_TONE.dangerSoft}`}
              onClick={() => void handleDelete(item.id)}
              disabled={deleteMutation.isPending}
              title={t('expenses.actions.delete')}
            >
              🗑
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <datalist id="expense-categories-autocomplete">
        {categorySuggestions.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {toastMessage && (
        <div
          className={`${TOAST_POSITION} rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      <PeriodFilterToolbar filter={periodFilter} />

      <TrendSummaryStrip
        income={0}
        expense={totalPeriodAmount}
        buckets={periodBuckets}
        extraMetrics={
          <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              {t('dashboard.columns.category')}
            </span>
            <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
              {categories.length}
            </strong>
          </article>
        }
      />

      {expenses.isError ? (
        <section
          className="flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          role="alert"
        >
          <strong>{t('dashboard.error.title')}</strong>
          <button
            type="button"
            className={`rounded-[2px] px-2 py-0.5 ${BUTTON_TONE.danger} ${TAP_CONTROL}`}
            onClick={refresh}
          >
            {t('common.retry')}
          </button>
        </section>
      ) : (
        <section className="grid gap-3">
          <DataPanel
            title={t('expenses.title')}
            description={t('expenses.subtitle')}
            counter={t('table.rowsCount', { count: filteredExpenses.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                <select
                  className={`h-6 min-h-6 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${TAP_INPUT}`}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label={t('common.allCategories')}
                >
                  <option value="all">{t('common.allCategories')}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
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
            <DataTable
              id="expenses"
              ariaLabel={t('expenses.title')}
              rows={filteredExpenses}
              loading={expenses.isLoading}
              emptyMessage={t('dashboard.noExpenses')}
              columns={expenseColumns}
              getRowKey={(item) => item.id}
            />
          </DataPanel>
        </section>
      )}
    </>
  );
}
