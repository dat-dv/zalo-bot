'use client';

import { useState, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ICategoryItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { useReactScan } from '@/shared/providers/react-scan-provider';
import {
  MOBILE_TOOLBAR_ROW,
  PHONE_CHIP,
  PHONE_TOOLBAR_INPUT,
  TAP_CONTROL,
  TOAST_POSITION,
} from '@/shared/ui/touch';

import {
  categoriesQueryKeys,
  useCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from '../../api/categories-query';
import { useDashboardQuery } from '@/modules/dashboard/api/dashboard-query';
import { AdjustBalanceModal } from '@/modules/dashboard/presentation/components/adjust-balance-modal';
import { InstallAppRow } from './install-app-row';

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const { isReactScanEnabled, setReactScanEnabled } = useReactScan();

  const [activeTab, setActiveTab] = useState<'categories' | 'preferences'>('categories');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [incomeSearch, setIncomeSearch] = useState('');

  // New category inputs
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newIncomeName, setNewIncomeName] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingIncome, setIsAddingIncome] = useState(false);

  // Edit draft
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [, startTransition] = useTransition();

  const dashboard = useDashboardQuery();
  const categoriesQuery = useCategoriesQuery();
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const refresh = () => void queryClient.invalidateQueries({ queryKey: categoriesQueryKeys.all });

  const rawList = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const expenseCategories = useMemo(() => {
    const list = rawList.filter((c) => c.type === 'expense');
    if (!expenseSearch.trim()) return list;
    const q = expenseSearch.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [rawList, expenseSearch]);

  const incomeCategories = useMemo(() => {
    const list = rawList.filter((c) => c.type === 'income');
    if (!incomeSearch.trim()) return list;
    const q = incomeSearch.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [rawList, incomeSearch]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      startTransition(() => setToastMessage(null));
    }, 3000);
  };

  const handleStartEdit = (category: ICategoryItem) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await updateMutation.mutateAsync({ id, data: { name: trimmed } });
      setEditingId(null);
      setEditName('');
      showToast(t('settings.categories.updated'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async (category: ICategoryItem) => {
    if (!window.confirm(t('settings.categories.deleteConfirm'))) return;
    try {
      await deleteMutation.mutateAsync(category.id);
      showToast(t('settings.categories.deleted'));
    } catch {
      // Error handled by mutation
    }
  };

  const handleCreateCategory = async (type: 'income' | 'expense') => {
    const name = (type === 'expense' ? newExpenseName : newIncomeName).trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({ type, name });
      if (type === 'expense') {
        setNewExpenseName('');
        setIsAddingExpense(false);
      } else {
        setNewIncomeName('');
        setIsAddingIncome(false);
      }
      showToast(t('settings.categories.created'));
    } catch {
      // Error handled by mutation
    }
  };

  const createCategoryColumns = (): DataTableColumn<ICategoryItem>[] => [
    {
      id: 'name',
      header: t('settings.categories.name'),
      minWidth: '220px',
      hideable: false,
      mobileSlot: 'primary',
      mobileCell: (item) => item.name,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <input
              type="text"
              className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveEdit(item.id);
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
              required
              aria-label={t('settings.categories.name')}
            />
          );
        }
        return (
          <span
            className="cursor-pointer font-semibold text-slate-900 select-none dark:text-slate-100"
            onDoubleClick={() => handleStartEdit(item)}
            title={item.name}
          >
            {item.name}
          </span>
        );
      },
    },
    {
      id: 'type',
      header: t('settings.categories.type'),
      minWidth: '100px',
      mobileSlot: 'secondary',
      mobileCell: (item) =>
        item.type === 'income' ? t('table.filter.income') : t('table.filter.expense'),
      cell: (item) => (
        <span
          className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
            item.type === 'income'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
          }`}
        >
          {item.type === 'income' ? t('table.filter.income') : t('table.filter.expense')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      minWidth: '130px',
      hideable: false,
      cell: (item) => {
        if (editingId === item.id) {
          return (
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-900 bg-slate-900 px-1.5 text-[11px] font-semibold text-white whitespace-nowrap transition-colors hover:bg-slate-800 disabled:opacity-50 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
                onClick={() => void handleSaveEdit(item.id)}
                title={t('expenses.actions.save')}
              >
                ✓
              </button>
              <button
                type="button"
                className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                onClick={handleCancelEdit}
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
              className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              onClick={() => handleStartEdit(item)}
              title={t('expenses.actions.edit')}
            >
              ✎
            </button>
            <button
              type="button"
              className="inline-flex h-[22px] min-h-[22px] shrink-0 cursor-pointer items-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-rose-900 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
              onClick={() => void handleDelete(item)}
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
      {toastMessage && (
        <div
          className={`${TOAST_POSITION} rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      <div className={`mb-4 flex gap-2 ${MOBILE_TOOLBAR_ROW}`}>
        <button
          type="button"
          className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
            activeTab === 'categories'
              ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
          onClick={() => setActiveTab('categories')}
        >
          {t('settings.tabs.categories')}
        </button>
        <button
          type="button"
          className={`inline-flex h-6 min-h-6 shrink-0 cursor-pointer items-center rounded-[3px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${PHONE_CHIP} ${
            activeTab === 'preferences'
              ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
          onClick={() => setActiveTab('preferences')}
        >
          {t('settings.tabs.preferences')}
        </button>
      </div>

      {categoriesQuery.isError ? (
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
      ) : activeTab === 'categories' ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-3 max-[640px]:grid-cols-1">
          {/* Expense Categories Panel */}
          <DataPanel
            title={t('settings.categories.expenseTitle')}
            counter={t('settings.categories.count', { count: expenseCategories.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-2 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                <input
                  type="search"
                  className={`h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${PHONE_TOOLBAR_INPUT}`}
                  placeholder={t('table.searchPlaceholder')}
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
                {!isAddingExpense && (
                  <button
                    type="button"
                    className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border border-sky-500 bg-sky-50 px-2 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300 max-[640px]:justify-center ${PHONE_CHIP}`}
                    onClick={() => setIsAddingExpense(true)}
                  >
                    {t('settings.categories.addExpense')}
                  </button>
                )}
              </div>
            }
          >
            {isAddingExpense && (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 max-[640px]:px-3 dark:border-slate-800 dark:bg-slate-900/60">
                <input
                  type="text"
                  className="h-6 min-h-6 min-w-0 flex-1 max-[640px]:h-10 rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                  placeholder={t('settings.categories.namePlaceholder')}
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateCategory('expense');
                    if (e.key === 'Escape') setIsAddingExpense(false);
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] cursor-pointer items-center justify-center rounded-[2px] border border-slate-900 bg-slate-900 px-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500 ${TAP_CONTROL}`}
                  onClick={() => void handleCreateCategory('expense')}
                  title={t('expenses.actions.save')}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] cursor-pointer items-center justify-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${TAP_CONTROL}`}
                  onClick={() => {
                    setIsAddingExpense(false);
                    setNewExpenseName('');
                  }}
                  title={t('expenses.actions.cancel')}
                >
                  ✕
                </button>
              </div>
            )}
            <DataTable
              id="settings-expense-categories"
              ariaLabel={t('settings.categories.expenseTitle')}
              rows={expenseCategories}
              loading={categoriesQuery.isLoading}
              emptyMessage={t('settings.categories.empty')}
              columns={createCategoryColumns()}
              getRowKey={(item) => item.id}
            />
          </DataPanel>

          {/* Income Categories Panel */}
          <DataPanel
            title={t('settings.categories.incomeTitle')}
            counter={t('settings.categories.count', { count: incomeCategories.length })}
            toolbar={
              <div className="flex flex-wrap items-center gap-2 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
                <input
                  type="search"
                  className={`h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${PHONE_TOOLBAR_INPUT}`}
                  placeholder={t('table.searchPlaceholder')}
                  value={incomeSearch}
                  onChange={(e) => setIncomeSearch(e.target.value)}
                  aria-label={t('table.searchPlaceholder')}
                />
                {!isAddingIncome && (
                  <button
                    type="button"
                    className={`inline-flex h-6 min-h-6 cursor-pointer items-center rounded-[3px] border border-sky-500 bg-sky-50 px-2 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300 max-[640px]:justify-center ${PHONE_CHIP}`}
                    onClick={() => setIsAddingIncome(true)}
                  >
                    {t('settings.categories.addIncome')}
                  </button>
                )}
              </div>
            }
          >
            {isAddingIncome && (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 max-[640px]:px-3 dark:border-slate-800 dark:bg-slate-900/60">
                <input
                  type="text"
                  className="h-6 min-h-6 min-w-0 flex-1 max-[640px]:h-10 rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
                  placeholder={t('settings.categories.namePlaceholder')}
                  value={newIncomeName}
                  onChange={(e) => setNewIncomeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateCategory('income');
                    if (e.key === 'Escape') setIsAddingIncome(false);
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] cursor-pointer items-center justify-center rounded-[2px] border border-slate-900 bg-slate-900 px-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500 ${TAP_CONTROL}`}
                  onClick={() => void handleCreateCategory('income')}
                  title={t('expenses.actions.save')}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className={`inline-flex h-[22px] min-h-[22px] cursor-pointer items-center justify-center rounded-[2px] border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${TAP_CONTROL}`}
                  onClick={() => {
                    setIsAddingIncome(false);
                    setNewIncomeName('');
                  }}
                  title={t('expenses.actions.cancel')}
                >
                  ✕
                </button>
              </div>
            )}
            <DataTable
              id="settings-income-categories"
              ariaLabel={t('settings.categories.incomeTitle')}
              rows={incomeCategories}
              loading={categoriesQuery.isLoading}
              emptyMessage={t('settings.categories.empty')}
              columns={createCategoryColumns()}
              getRowKey={(item) => item.id}
            />
          </DataPanel>
        </div>
      ) : (
        <section className="grid gap-3">
          <DataPanel title={t('settings.tabs.preferences')} description={t('settings.subtitle')}>
            <div className="flex flex-col gap-4 p-6 max-[640px]:px-3 max-[640px]:py-2">
              <article className="flex items-center justify-between border-b border-slate-200 py-3 dark:border-slate-800">
                <div>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {t('common.language')}
                  </strong>
                  <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                    {t('settings.preferences.languageDescription')}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-[2px] border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {t('settings.preferences.supported')}
                </span>
              </article>
              <article className="flex items-center justify-between border-b border-slate-200 py-3 dark:border-slate-800">
                <div>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {t('settings.preferences.themeTitle')}
                  </strong>
                  <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                    {t('settings.preferences.themeDescription')}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-[2px] border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {t('settings.preferences.supported')}
                </span>
              </article>
              <InstallAppRow />
              <article className="flex items-center justify-between gap-4 border-b border-slate-200 py-3 dark:border-slate-800">
                <div>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {t('settings.preferences.walletManagementTitle')}
                  </strong>
                  <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                    {t('settings.preferences.walletManagementDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustBalanceOpen(true)}
                  className="inline-flex h-6 min-w-[76px] shrink-0 cursor-pointer items-center justify-center gap-1 max-[640px]:h-10 max-[640px]:px-3 rounded-[3px] border border-indigo-300 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/60"
                >
                  <span>⚖️</span>
                  {t('transactions.balanceAdjust.actionButton')}
                </button>
              </article>
              <article className="flex items-center justify-between gap-4 py-3">
                <div>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {t('settings.preferences.reactScanTitle')}
                  </strong>
                  <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                    {t('settings.preferences.reactScanDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isReactScanEnabled}
                  aria-label={t('settings.preferences.reactScanTitle')}
                  className={`inline-flex h-6 min-w-[76px] shrink-0 items-center justify-center rounded-[3px] border px-2 text-[11px] font-semibold transition-colors max-[640px]:h-10 max-[640px]:px-3 ${
                    isReactScanEnabled
                      ? 'border-violet-500 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-300'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => setReactScanEnabled(!isReactScanEnabled)}
                >
                  {isReactScanEnabled
                    ? t('settings.preferences.reactScanEnabled')
                    : t('settings.preferences.reactScanDisabled')}
                </button>
              </article>
            </div>
          </DataPanel>
        </section>
      )}

      {/* Adjust Balance Modal */}
      <AdjustBalanceModal
        isOpen={isAdjustBalanceOpen}
        currentBalance={dashboard.data?.finance.ledgerBalance ?? 0}
        onClose={() => setIsAdjustBalanceOpen(false)}
        onSuccess={(msg) => msg && showToast(msg)}
      />
    </>
  );
}
