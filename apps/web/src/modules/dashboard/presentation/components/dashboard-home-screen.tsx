'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { APP_ROUTES, localeTag } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/store/money-visibility-store';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { TransactionsTable, type TransactionTableItem } from './transactions-table';
import { DebtsTable } from '@/modules/debts/view/debts-table';
import { TasksTable } from './tasks-table';
import { RemindersTable } from './reminders-table';
import { CalendarTable } from './calendar-table';
import { AdjustBalanceModal } from './adjust-balance-modal';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';
import { TOAST_POSITION } from '@/shared/ui/touch';
import { useIsCompact, useIsPhone } from '@/shared/hooks/use-media-query';

type DashboardData = NonNullable<ReturnType<typeof useDashboardQuery>['data']>;

/** Compact screens show a short preview per widget; the full list lives on its own page. */
const HOME_COMPACT_ROW_LIMIT = 5;

// Phones: quick links form a 4-column grid (two rows, nothing scrolls sideways); long labels
// wrap to two lines inside their 40px+ tile.
const QUICK_LINKS_PHONE = 'max-[640px]:grid max-[640px]:grid-cols-4';
const QUICK_LINK_PHONE =
  'shrink-0 whitespace-nowrap max-[640px]:h-auto max-[640px]:min-h-10 max-[640px]:justify-center max-[640px]:px-1 max-[640px]:py-1 max-[640px]:text-center max-[640px]:text-[12px] max-[640px]:leading-tight max-[640px]:whitespace-normal';

function limitRows<T>(rows: T[], isCompact: boolean): T[] {
  return isCompact ? rows.slice(0, HOME_COMPACT_ROW_LIMIT) : rows;
}

function ViewAllLink({ href }: { href: string }) {
  const { t } = useLocale();
  return (
    <Link
      href={href}
      className="flex min-h-10 items-center justify-center gap-1 border-t border-slate-200 text-[12.5px] font-medium text-sky-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-sky-400 dark:hover:bg-slate-800/60"
    >
      {t('dashboard.viewAll')}
      <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}

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
    <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60 max-[640px]:min-h-[52px] max-[640px]:px-2.5 max-[640px]:py-1.5">
      <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </span>
      <strong
        className={`mt-0.5 block text-base font-bold tabular-nums tracking-tight max-[640px]:text-[14px] max-[640px]:break-words ${toneStyles[tone]}`}
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
  const isCompact = useIsCompact();
  // Phones hide the per-panel search, so a query typed before rotating must stop filtering.
  const isPhone = useIsPhone();
  const taskQuery = isPhone ? '' : taskSearch;
  const reminderQuery = isPhone ? '' : reminderSearch;
  const calendarQuery = isPhone ? '' : calendarSearch;
  const txQuery = isPhone ? '' : txSearch;
  const debtQuery = isPhone ? '' : debtSearch;
  const activityQuery = isPhone ? '' : activitySearch;

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
    if (!taskQuery.trim()) return pendingTasks;
    const q = taskQuery.toLowerCase();
    return pendingTasks.filter((item) => item.title.toLowerCase().includes(q));
  }, [pendingTasks, taskQuery]);

  const filteredReminders = useMemo(() => {
    if (!reminderQuery.trim()) return data.reminders;
    const q = reminderQuery.toLowerCase();
    return data.reminders.filter((item) => item.title.toLowerCase().includes(q));
  }, [data.reminders, reminderQuery]);

  const filteredCalendar = useMemo(() => {
    if (!calendarQuery.trim()) return data.calendar;
    const q = calendarQuery.toLowerCase();
    return data.calendar.filter((item) => item.title.toLowerCase().includes(q));
  }, [data.calendar, calendarQuery]);

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
    if (!txQuery.trim()) return transactionsWithBalance;
    const q = txQuery.toLowerCase();
    return transactionsWithBalance.filter(
      (item) =>
        item.category.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.placeName && item.placeName.toLowerCase().includes(q)),
    );
  }, [transactionsWithBalance, txQuery]);

  const filteredDebts = useMemo(() => {
    if (!debtQuery.trim()) return data.debts;
    const q = debtQuery.toLowerCase();
    return data.debts.filter(
      (item) =>
        item.counterparty.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)),
    );
  }, [data.debts, debtQuery]);

  const filteredActivity = useMemo(() => {
    if (!activityQuery.trim()) return data.activity;
    const q = activityQuery.toLowerCase();
    return data.activity.filter(
      (item) => item.action.toLowerCase().includes(q) || item.tableName.toLowerCase().includes(q),
    );
  }, [data.activity, activityQuery]);

  const activityColumns: DataTableColumn<DashboardData['activity'][number]>[] = [
    {
      id: 'action',
      header: t('dashboard.columns.action'),
      minWidth: '180px',
      hideable: false,
      mobileSlot: 'primary',
      mobileCell: (item) => `${item.action} · ${item.tableName}`,
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
      mobileSlot: 'trailing',
      mobileCell: (item) => date(item.createdAt),
      cell: (item) => (
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {date(item.createdAt)}
        </span>
      ),
    },
  ];

  const panelSearch = (value: string, onChange: (next: string) => void) =>
    isPhone ? undefined : (
      <input
        type="search"
        className="h-6 min-h-6 w-44 rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:w-full"
        placeholder={t('table.searchPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('table.searchPlaceholder')}
      />
    );

  const rootDebtsShown = filteredDebts.filter((d) => !d.parentDebtId);

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
        className={`flex flex-wrap gap-1.5 rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 ${QUICK_LINKS_PHONE}`}
        aria-label={t('dashboard.quickStats')}
      >
        <Link
          href={APP_ROUTES.transactions}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
        >
          {t('nav.transactions')}
        </Link>
        <button
          type="button"
          onClick={() => setIsAdjustBalanceOpen(true)}
          className={`inline-flex h-6 min-h-6 cursor-pointer items-center gap-1 rounded-[3px] border border-indigo-300 bg-indigo-50 px-2 text-[11.5px] font-semibold text-indigo-700 transition-colors hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/60 ${QUICK_LINK_PHONE}`}
        >
          <span aria-hidden="true">⚖️</span>
          {t('transactions.balanceAdjust.actionButton')}
        </button>
        <Link
          href={APP_ROUTES.debts}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
        >
          {t('nav.debts')}
        </Link>
        <Link
          href={APP_ROUTES.analytics}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
        >
          {t('nav.analytics')}
        </Link>
        <Link
          href={APP_ROUTES.calendar}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
        >
          {t('nav.calendar')}
        </Link>
        <Link
          href={APP_ROUTES.tasks}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
        >
          {t('nav.tasks')}
        </Link>
        <Link
          href={APP_ROUTES.reminders}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
        >
          {t('nav.reminders')}
        </Link>
        <Link
          href={APP_ROUTES.contacts}
          className={`inline-flex h-6 min-h-6 items-center rounded-[3px] border border-slate-300 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 ${QUICK_LINK_PHONE}`}
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
          counter={t('table.rowsCount', { count: filteredTasks.length })}
          toolbar={panelSearch(taskSearch, setTaskSearch)}
        >
          <TasksTable
            id="home-tasks"
            ariaLabel={t('dashboard.tasks')}
            tasks={limitRows(filteredTasks, isCompact)}
            emptyMessage={t('dashboard.noTasks')}
          />
          {isCompact && <ViewAllLink href={APP_ROUTES.tasks} />}
        </DataPanel>

        <DataPanel
          title={t('dashboard.reminders')}
          titleHref={APP_ROUTES.reminders}
          counter={t('table.rowsCount', { count: filteredReminders.length })}
          toolbar={panelSearch(reminderSearch, setReminderSearch)}
        >
          <RemindersTable
            id="home-reminders"
            ariaLabel={t('dashboard.reminders')}
            reminders={limitRows(filteredReminders, isCompact)}
            emptyMessage={t('dashboard.noReminders')}
          />
          {isCompact && <ViewAllLink href={APP_ROUTES.reminders} />}
        </DataPanel>

        <DataPanel
          title={t('dashboard.calendar')}
          titleHref={APP_ROUTES.calendar}
          description={data.user.googleConnected ? undefined : t('dashboard.connectGoogleTip')}
          counter={t('table.rowsCount', { count: filteredCalendar.length })}
          toolbar={panelSearch(calendarSearch, setCalendarSearch)}
        >
          <CalendarTable
            id="home-calendar"
            ariaLabel={t('dashboard.calendar')}
            events={limitRows(filteredCalendar, isCompact)}
            emptyMessage={t('dashboard.noCalendar')}
          />
          {isCompact && <ViewAllLink href={APP_ROUTES.calendar} />}
        </DataPanel>

        <DataPanel
          title={t('dashboard.transactions')}
          titleHref={APP_ROUTES.transactions}
          counter={t('table.rowsCount', { count: filteredTransactions.length })}
          toolbar={panelSearch(txSearch, setTxSearch)}
        >
          <TransactionsTable
            id="home-transactions"
            ariaLabel={t('dashboard.transactions')}
            transactions={limitRows(filteredTransactions, isCompact)}
            emptyMessage={t('dashboard.noTransactions')}
          />
          {isCompact && <ViewAllLink href={APP_ROUTES.transactions} />}
        </DataPanel>

        <DataPanel
          title={t('dashboard.openDebts')}
          titleHref={APP_ROUTES.debts}
          counter={t('table.rowsCount', { count: rootDebtsShown.length })}
          toolbar={panelSearch(debtSearch, setDebtSearch)}
        >
          <DebtsTable
            id="home-debts"
            ariaLabel={t('dashboard.openDebts')}
            // DebtsTable renders root debts and nests children, so the preview limits roots.
            debts={isCompact ? rootDebtsShown.slice(0, HOME_COMPACT_ROW_LIMIT) : filteredDebts}
            emptyMessage={t('dashboard.noDebts')}
          />
          {isCompact && <ViewAllLink href={APP_ROUTES.debts} />}
        </DataPanel>

        <DataPanel
          title={t('dashboard.activity')}
          counter={t('table.rowsCount', { count: filteredActivity.length })}
          toolbar={panelSearch(activitySearch, setActivitySearch)}
        >
          <DataTable
            id="home-activity"
            ariaLabel={t('dashboard.activity')}
            rows={limitRows(filteredActivity, isCompact)}
            emptyMessage={t('dashboard.noActivity')}
            columns={activityColumns}
            getRowKey={(item) => item.id}
          />
        </DataPanel>
      </section>

      {/* Adjust Balance Modal */}
      <AdjustBalanceModal
        isOpen={isAdjustBalanceOpen}
        currentBalance={data.finance.ledgerBalance}
        onClose={() => setIsAdjustBalanceOpen(false)}
        onSuccess={(msg) => msg && showToast(msg)}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`${TOAST_POSITION} rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100`}
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
      mobileSlot: 'primary',
      cell: () => null,
    },
    {
      id: 'createdAt',
      header: t('dashboard.columns.date'),
      align: 'right',
      minWidth: '140px',
      mobileSlot: 'trailing',
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
            className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60 max-[640px]:min-h-[52px] max-[640px]:px-2.5 max-[640px]:py-1.5"
            key={index}
          >
            <span className="block h-2.5 w-16 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
            <strong className="mt-2 block h-4 w-24 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </section>

      {/* Quick links skeleton */}
      <section
        className={`flex flex-wrap gap-1.5 rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 ${QUICK_LINKS_PHONE}`}
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="h-6 w-20 shrink-0 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:h-10 max-[640px]:w-auto"
          />
        ))}
      </section>

      {/* 6 DataPanels in 2-column grid */}
      <section className="grid grid-cols-2 gap-3 max-[960px]:grid-cols-1" aria-hidden="true">
        <DataPanel
          title={t('dashboard.tasks')}
          titleHref={APP_ROUTES.tasks}
          toolbar={
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:hidden" />
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
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:hidden" />
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
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:hidden" />
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
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:hidden" />
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
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:hidden" />
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
            <div className="h-6 w-44 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 max-[640px]:hidden" />
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
