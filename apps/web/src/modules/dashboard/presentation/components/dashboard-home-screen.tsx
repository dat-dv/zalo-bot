'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { APP_ROUTES, localeTag } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { TransactionsTable, type TransactionTableItem } from './transactions-table';
import { DebtsTable } from '@/modules/debts/view/debts-table';
import { TasksTable } from './tasks-table';
import { RemindersTable } from './reminders-table';
import { CalendarTable } from './calendar-table';
import { AdjustBalanceModal } from './adjust-balance-modal';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';

type DashboardData = NonNullable<ReturnType<typeof useDashboardQuery>['data']>;

export function DashboardHomeScreen() {
  const queryClient = useQueryClient();
  const [isLoggedOut] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('status') === 'logged_out';
  });
  const dashboard = useDashboardQuery({ enabled: !isLoggedOut });

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });

  if (isLoggedOut) {
    return <SessionStateScreen reason="logged_out" />;
  }

  if (dashboard.isError) {
    return <SessionStateScreen reason="expired" onRetry={refresh} />;
  }

  if (dashboard.isLoading || !dashboard.data) {
    return <DashboardHomeSkeleton />;
  }

  const data = dashboard.data;

  return <DashboardHomeContent data={data} />;
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative';
}) {
  const toneStyles = {
    neutral: 'text-slate-900 dark:text-slate-100',
    positive: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    negative: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
      <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </span>
      <strong
        className={`mt-0.5 block text-base font-bold tabular-nums tracking-tight ${toneStyles[tone]}`}
      >
        {value}
      </strong>
    </article>
  );
}

function DashboardHomeContent({ data }: { data: DashboardData }) {
  const { locale, t } = useLocale();
  const money = useMoneyFormatter();
  const [taskSearch, setTaskSearch] = useState('');
  const [reminderSearch, setReminderSearch] = useState('');
  const [calendarSearch, setCalendarSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [debtSearch, setDebtSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const date = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(localeTag(locale), {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(value))
      : t('common.notSet');

  const pendingTasks = useMemo(() => {
    return data.tasks.filter((item) => item.status !== 'completed');
  }, [data.tasks]);

  const rootDebts = useMemo(() => data.debts.filter((d) => !d.parentDebtId), [data.debts]);
  const attentionCount = rootDebts.length + data.reminders.length + pendingTasks.length;

  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return pendingTasks;
    const q = taskSearch.toLowerCase();
    return pendingTasks.filter((item) => item.title.toLowerCase().includes(q));
  }, [pendingTasks, taskSearch]);

  const filteredReminders = useMemo(() => {
    if (!reminderSearch.trim()) return data.reminders;
    const q = reminderSearch.toLowerCase();
    return data.reminders.filter((item) => item.title.toLowerCase().includes(q));
  }, [data.reminders, reminderSearch]);

  const filteredCalendar = useMemo(() => {
    if (!calendarSearch.trim()) return data.calendar;
    const q = calendarSearch.toLowerCase();
    return data.calendar.filter((item) => item.title.toLowerCase().includes(q));
  }, [data.calendar, calendarSearch]);

  const transactionsWithBalance = useMemo<TransactionTableItem[]>(() => {
    const list = data.transactions ?? [];
    if (!list.length) return [];

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
  }, [data.transactions]);

  const filteredTransactions = useMemo(() => {
    if (!txSearch.trim()) return transactionsWithBalance;
    const q = txSearch.toLowerCase();
    return transactionsWithBalance.filter(
      (item) =>
        item.category.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.placeName && item.placeName.toLowerCase().includes(q)),
    );
  }, [transactionsWithBalance, txSearch]);

  const filteredDebts = useMemo(() => {
    if (!debtSearch.trim()) return data.debts;
    const q = debtSearch.toLowerCase();
    return data.debts.filter(
      (item) =>
        item.counterparty.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)),
    );
  }, [data.debts, debtSearch]);

  const filteredActivity = useMemo(() => {
    if (!activitySearch.trim()) return data.activity;
    const q = activitySearch.toLowerCase();
    return data.activity.filter(
      (item) => item.action.toLowerCase().includes(q) || item.tableName.toLowerCase().includes(q),
    );
  }, [data.activity, activitySearch]);

  const activityColumns: DataTableColumn<DashboardData['activity'][number]>[] = [
    {
      id: 'action',
      header: t('dashboard.columns.action'),
      minWidth: '180px',
      hideable: false,
      cell: (item) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {item.action} · {item.tableName}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: t('dashboard.columns.date'),
      align: 'right',
      minWidth: '140px',
      cell: (item) => (
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {date(item.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section
        className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 max-[640px]:grid-cols-2"
        aria-label={t('dashboard.quickStats')}
      >
        <Metric
          label={t('dashboard.incomeTotal')}
          value={money(data.finance.income)}
          tone="positive"
        />
        <Metric
          label={t('dashboard.expenseTotal')}
          value={money(data.finance.expense)}
          tone="warning"
        />
        <Metric
          label={t('dashboard.balance')}
          value={money(data.finance.balance)}
          tone={data.finance.balance >= 0 ? 'positive' : 'negative'}
        />
        <Metric
          label={t('dashboard.receivableTotal')}
          value={money(data.finance.receivable)}
          tone="positive"
        />
        <Metric
          label={t('dashboard.payableTotal')}
          value={money(data.finance.payable)}
          tone="warning"
        />
        <Metric
          label={t('dashboard.attentionItems')}
          value={String(attentionCount)}
          tone="warning"
        />
      </section>

      <section
        className="flex flex-wrap gap-1.5 rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
        aria-label={t('dashboard.quickStats')}
      >
        <Link
          href={APP_ROUTES.transactions}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.transactions')}
        </Link>
        <button
          type="button"
          onClick={() => setIsAdjustBalanceOpen(true)}
          className="inline-flex h-6 min-h-6 cursor-pointer items-center gap-1 rounded-[3px] border border-indigo-300 bg-indigo-50 px-2 text-[11.5px] font-semibold text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/60"
        >
          <span>⚖️</span>
          {t('transactions.balanceAdjust.actionButton')}
        </button>
        <Link
          href={APP_ROUTES.debts}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.debts')}
        </Link>
        <Link
          href={APP_ROUTES.analytics}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.analytics')}
        </Link>
        <Link
          href={APP_ROUTES.calendar}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.calendar')}
        </Link>
        <Link
          href={APP_ROUTES.tasks}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.tasks')}
        </Link>
        <Link
          href={APP_ROUTES.reminders}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.reminders')}
        </Link>
        <Link
          href={APP_ROUTES.contacts}
          className="inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        >
          {t('nav.contacts')}
        </Link>
      </section>

      {data.admin && (
        <section className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {t('dashboard.admin')}
          </strong>
          <span>{t('dashboard.usersCount', { count: data.admin.userCount })}</span>
          <span>
            {t('dashboard.googleConnectedCount', { count: data.admin.googleConnectedCount })}
          </span>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 max-[960px]:grid-cols-1">
        <DataPanel
          title={t('dashboard.tasks')}
          titleHref={APP_ROUTES.tasks}
          description={data.user.googleConnected ? undefined : t('dashboard.connectGoogleTip')}
          counter={t('table.rowsCount', { count: filteredTasks.length })}
          toolbar={
            <input
              type="search"
              className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
              placeholder={t('table.searchPlaceholder')}
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              aria-label={t('table.searchPlaceholder')}
            />
          }
        >
          <TasksTable
            id="home-tasks"
            ariaLabel={t('dashboard.tasks')}
            tasks={filteredTasks}
            emptyMessage={t('dashboard.noTasks')}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.reminders')}
          titleHref={APP_ROUTES.reminders}
          counter={t('table.rowsCount', { count: filteredReminders.length })}
          toolbar={
            <input
              type="search"
              className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
              placeholder={t('table.searchPlaceholder')}
              value={reminderSearch}
              onChange={(e) => setReminderSearch(e.target.value)}
              aria-label={t('table.searchPlaceholder')}
            />
          }
        >
          <RemindersTable
            id="home-reminders"
            ariaLabel={t('dashboard.reminders')}
            reminders={filteredReminders}
            emptyMessage={t('dashboard.noReminders')}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.calendar')}
          titleHref={APP_ROUTES.calendar}
          description={data.user.googleConnected ? undefined : t('dashboard.connectGoogleTip')}
          counter={t('table.rowsCount', { count: filteredCalendar.length })}
          toolbar={
            <input
              type="search"
              className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
              placeholder={t('table.searchPlaceholder')}
              value={calendarSearch}
              onChange={(e) => setCalendarSearch(e.target.value)}
              aria-label={t('table.searchPlaceholder')}
            />
          }
        >
          <CalendarTable
            id="home-calendar"
            ariaLabel={t('dashboard.calendar')}
            events={filteredCalendar}
            emptyMessage={t('dashboard.noCalendar')}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.transactions')}
          titleHref={APP_ROUTES.transactions}
          counter={t('table.rowsCount', { count: filteredTransactions.length })}
          toolbar={
            <input
              type="search"
              className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
              placeholder={t('table.searchPlaceholder')}
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              aria-label={t('table.searchPlaceholder')}
            />
          }
        >
          <TransactionsTable
            id="home-transactions"
            ariaLabel={t('dashboard.transactions')}
            transactions={filteredTransactions}
            emptyMessage={t('dashboard.noTransactions')}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.openDebts')}
          titleHref={APP_ROUTES.debts}
          counter={t('table.rowsCount', {
            count: filteredDebts.filter((d) => !d.parentDebtId).length,
          })}
          toolbar={
            <input
              type="search"
              className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
              placeholder={t('table.searchPlaceholder')}
              value={debtSearch}
              onChange={(e) => setDebtSearch(e.target.value)}
              aria-label={t('table.searchPlaceholder')}
            />
          }
        >
          <DebtsTable
            id="home-debts"
            ariaLabel={t('dashboard.openDebts')}
            debts={filteredDebts}
            emptyMessage={t('dashboard.noDebts')}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.activity')}
          counter={t('table.rowsCount', { count: filteredActivity.length })}
          toolbar={
            <input
              type="search"
              className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
              placeholder={t('table.searchPlaceholder')}
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              aria-label={t('table.searchPlaceholder')}
            />
          }
        >
          <DataTable
            id="home-activity"
            ariaLabel={t('dashboard.activity')}
            rows={filteredActivity}
            emptyMessage={t('dashboard.noActivity')}
            columns={activityColumns}
            getRowKey={(item) => item.id}
          />
        </DataPanel>
      </section>

      {/* Adjust Balance Modal */}
      <AdjustBalanceModal
        isOpen={isAdjustBalanceOpen}
        currentBalance={data.finance.balance}
        onClose={() => setIsAdjustBalanceOpen(false)}
        onSuccess={(msg) => msg && showToast(msg)}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function DashboardHomeSkeleton() {
  const { t } = useLocale();

  const activityColumns: DataTableColumn<{
    id: string;
    action: string;
    tableName: string;
    createdAt: string;
  }>[] = [
    {
      id: 'action',
      header: t('dashboard.columns.action'),
      minWidth: '180px',
      hideable: false,
      cell: () => null,
    },
    {
      id: 'createdAt',
      header: t('dashboard.columns.date'),
      align: 'right',
      minWidth: '140px',
      cell: () => null,
    },
  ];

  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {/* 6 KPI Cards */}
      <section
        className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 max-[640px]:grid-cols-2"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60"
            key={index}
          >
            <span className="block h-2.5 w-16 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
            <strong className="mt-2 block h-4 w-24 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </section>

      {/* Quick links skeleton */}
      <section
        className="flex flex-wrap gap-1.5 rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
        aria-hidden="true"
      >
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="h-6 w-20 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
          />
        ))}
      </section>

      {/* 6 DataPanels in 2-column grid */}
      <section className="grid grid-cols-2 gap-3 max-[960px]:grid-cols-1" aria-hidden="true">
        <DataPanel
          title={t('dashboard.tasks')}
          titleHref={APP_ROUTES.tasks}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <TasksTable
            id="home-tasks-skeleton"
            ariaLabel={t('dashboard.tasks')}
            tasks={[]}
            emptyMessage={t('dashboard.noTasks')}
            loading={true}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.reminders')}
          titleHref={APP_ROUTES.reminders}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <RemindersTable
            id="home-reminders-skeleton"
            ariaLabel={t('dashboard.reminders')}
            reminders={[]}
            emptyMessage={t('dashboard.noReminders')}
            loading={true}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.calendar')}
          titleHref={APP_ROUTES.calendar}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <CalendarTable
            id="home-calendar-skeleton"
            ariaLabel={t('dashboard.calendar')}
            events={[]}
            emptyMessage={t('dashboard.noCalendar')}
            loading={true}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.transactions')}
          titleHref={APP_ROUTES.transactions}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <TransactionsTable
            id="home-transactions-skeleton"
            ariaLabel={t('dashboard.transactions')}
            transactions={[]}
            emptyMessage={t('dashboard.noTransactions')}
            loading={true}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.openDebts')}
          titleHref={APP_ROUTES.debts}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <DebtsTable
            id="home-debts-skeleton"
            ariaLabel={t('dashboard.openDebts')}
            debts={[]}
            emptyMessage={t('dashboard.noDebts')}
            loading={true}
          />
        </DataPanel>

        <DataPanel
          title={t('dashboard.activity')}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <DataTable
            id="home-activity-skeleton"
            ariaLabel={t('dashboard.activity')}
            rows={[]}
            emptyMessage={t('dashboard.noActivity')}
            loading={true}
            columns={activityColumns}
            getRowKey={(item) => item.id}
          />
        </DataPanel>
      </section>
    </div>
  );
}
