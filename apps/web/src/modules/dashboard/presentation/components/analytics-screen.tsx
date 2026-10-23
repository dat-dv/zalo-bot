'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type IAnalyticsTrendBucket } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/store/money-visibility-store';
import { DataPanel, DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { usePeriodFilter } from '@/shared/hooks/use-period-filter';
import { PeriodFilterToolbar } from '@/shared/ui/period-filter-toolbar';
import { SessionStateScreen } from '@/modules/auth/view/session-state-screen';
import { dashboardQueryKeys, useDashboardQuery } from '../../api/dashboard-query';
import { useFinanceAnalyticsQuery } from '../../api/analytics-query';
import { CashflowTrendChart } from '@/shared/ui/charts/cashflow-trend-chart';
import { CategoryDonutChart } from '@/shared/ui/charts/category-donut-chart';
import { DebtStructureChart } from '@/shared/ui/charts/debt-structure-chart';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { MetricGrid, MetricGridSkeleton, type MetricGridItem } from '@/shared/ui/metric-grid';
import { PHONE_CHIP } from '@/shared/ui/touch';

// Chart/Table toggle: compact toolbar chips sharing the row on phones.
const PHONE_TOGGLE = `max-[640px]:flex-1 ${PHONE_CHIP}`;

export function AnalyticsScreen() {
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const money = useMoneyFormatter();
  const periodFilter = usePeriodFilter('month');
  const [cashflowViewMode, setCashflowViewMode] = useState<'chart' | 'table'>('chart');

  const dashboard = useDashboardQuery();

  const startAtStr = useMemo(() => {
    if (periodFilter.grain === 'all') return undefined;
    return periodFilter.startDate.toISOString();
  }, [periodFilter.grain, periodFilter.startDate]);

  const endAtStr = useMemo(() => {
    if (periodFilter.grain === 'all') return undefined;
    return periodFilter.endDate.toISOString();
  }, [periodFilter.grain, periodFilter.endDate]);

  const analyticsQuery = useFinanceAnalyticsQuery({
    startAt: startAtStr,
    endAt: endAtStr,
    grain: periodFilter.grain,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
    void queryClient.invalidateQueries({ queryKey: ['finance-analytics'] });
  };

  const rawData = dashboard.data;
  const rawTransactions = useMemo(() => rawData?.transactions ?? [], [rawData?.transactions]);

  // Filter transactions by period
  const periodTransactions = useMemo(() => {
    return rawTransactions.filter((item) => periodFilter.isItemInPeriod(item.occurredAt));
  }, [rawTransactions, periodFilter]);

  // Aggregate metrics for selected period
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

  // Aggregate opening balance before selected period
  const openingBalance = useMemo(() => {
    let bal = 0;
    const startRange = periodFilter.startDate ? periodFilter.startDate.getTime() : 0;
    if (startRange > 0 && periodFilter.grain !== 'all') {
      for (const item of rawTransactions) {
        const itemDate = new Date(item.occurredAt).getTime();
        if (itemDate < startRange) {
          if (item.type === 'income') bal += item.amount;
          else bal -= item.amount;
        }
      }
    }
    return bal;
  }, [rawTransactions, periodFilter.startDate, periodFilter.grain]);

  const fallbackTrendBuckets = useMemo<IAnalyticsTrendBucket[]>(() => {
    let running = openingBalance;
    return periodBuckets.map((b) => {
      const net = b.income - b.expense;
      running += net;
      return {
        key: b.key,
        label: b.label,
        income: b.income,
        expense: b.expense,
        netCashflow: net,
        balance: running,
        startAt: '',
        endAt: '',
      };
    });
  }, [periodBuckets, openingBalance]);

  const totalIncome = analyticsQuery.data?.summary.income ?? periodIncome;
  const totalExpense = analyticsQuery.data?.summary.expense ?? periodExpense;
  const netSavings = analyticsQuery.data?.summary.balance ?? totalIncome - totalExpense;
  const savingsRate =
    analyticsQuery.data?.summary.netSavingsRate ??
    (totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100) : 0);
  const currentPosition = analyticsQuery.data?.currentPosition;
  const netDebt =
    analyticsQuery.data?.debts.netDebt ??
    (rawData?.finance.receivable ?? 0) - (rawData?.finance.payable ?? 0);
  const periodMetrics: MetricGridItem[] = [
    {
      label: t('dashboard.incomeTotal'),
      value: money(totalIncome),
      valueClassName: 'text-sky-700 dark:text-sky-400',
    },
    {
      label: t('dashboard.expenseTotal'),
      value: money(totalExpense),
      valueClassName: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: t('analytics.kpi.netSavings'),
      value: money(netSavings),
      valueClassName:
        netSavings >= 0
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
    },
    {
      label: t('analytics.kpi.savingsRate'),
      value: `${savingsRate.toFixed(1)}%`,
      valueClassName:
        savingsRate >= 20
          ? 'text-emerald-700 dark:text-emerald-400'
          : savingsRate > 0
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-slate-700 dark:text-slate-300',
    },
  ];
  const currentPositionMetrics: MetricGridItem[] = [
    {
      label: t('analytics.currentPosition.cashflowBalance'),
      value: money(currentPosition?.cashflowBalance ?? 0),
      valueClassName: 'text-sky-700 dark:text-sky-400',
    },
    {
      label: t('analytics.currentPosition.receivable'),
      value: money(currentPosition?.receivable ?? 0),
      valueClassName: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: t('analytics.currentPosition.payable'),
      value: money(currentPosition?.payable ?? 0),
      valueClassName: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: t('analytics.currentPosition.netWorth'),
      value: money(currentPosition?.netWorth ?? 0),
      valueClassName:
        (currentPosition?.netWorth ?? 0) >= 0
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
    },
  ];

  const trendBuckets = useMemo<IAnalyticsTrendBucket[]>(() => {
    return analyticsQuery.data?.trend ?? fallbackTrendBuckets;
  }, [analyticsQuery.data?.trend, fallbackTrendBuckets]);

  type CashflowRow = IAnalyticsTrendBucket & { id: string };

  const cashflowRows = useMemo<CashflowRow[]>(() => {
    return trendBuckets.map((bucket) => ({
      ...bucket,
      id: bucket.key,
    }));
  }, [trendBuckets]);

  const cashflowColumns = useMemo<DataTableColumn<CashflowRow>[]>(
    () => [
      {
        id: 'period',
        header: t('analytics.cashflow.column.period'),
        width: '22%',
        mobileSlot: 'primary',
        mobileCell: (item) => item.label,
        cell: (item) => (
          <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
        ),
      },
      {
        id: 'income',
        header: t('analytics.cashflow.column.income'),
        align: 'right',
        width: '19%',
        mobileSlot: 'secondary',
        mobileCell: (item) => `${t('chart.income')} +${money(item.income)}`,
        cell: (item) => (
          <span className="tabular-nums font-medium text-sky-700 dark:text-sky-400">
            + {money(item.income)}
          </span>
        ),
      },
      {
        id: 'expense',
        header: t('analytics.cashflow.column.expense'),
        align: 'right',
        width: '19%',
        mobileSlot: 'secondary',
        mobileCell: (item) => `${t('chart.expense')} -${money(item.expense)}`,
        cell: (item) => (
          <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">
            - {money(item.expense)}
          </span>
        ),
      },
      {
        id: 'netCashflow',
        header: t('analytics.cashflow.column.netCashflow'),
        align: 'right',
        width: '20%',
        mobileSlot: 'trailing',
        cell: (item) => {
          const net =
            typeof item.netCashflow === 'number' ? item.netCashflow : item.income - item.expense;
          const isPos = net >= 0;
          return (
            <span
              className={`tabular-nums font-medium ${
                isPos
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isPos ? '+ ' : ''}
              {money(net)}
            </span>
          );
        },
      },
      {
        id: 'balance',
        header: t('analytics.cashflow.column.balance'),
        align: 'right',
        width: '20%',
        cell: (item) => {
          const isPos = item.balance >= 0;
          return (
            <span
              className={`tabular-nums font-bold ${
                isPos ? 'text-violet-700 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {money(item.balance)}
            </span>
          );
        },
      },
    ],
    [money, t],
  );

  if (dashboard.isError) {
    return <SessionStateScreen reason="expired" onRetry={refresh} />;
  }

  if (dashboard.isLoading || !rawData) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {/* Top Filter Toolbar */}
        <PeriodFilterToolbar filter={periodFilter} />

        <MetricGridSkeleton count={4} />
        <DataPanel title={t('analytics.currentPosition.title')}>
          <MetricGridSkeleton count={4} />
        </DataPanel>

        {/* Cashflow Trend Panel Skeleton */}
        <DataPanel
          title={t('analytics.chart.cashflowTrend')}
          toolbar={
            <div className="flex items-center gap-1">
              <div className="h-6 w-16 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
              <div className="h-6 w-16 animate-pulse rounded-[3px] border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
            </div>
          }
        >
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-4">
              <div className="h-3 w-20 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-20 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-20 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex h-[220px] w-full items-end gap-2 rounded border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 animate-pulse rounded-t-[2px] bg-slate-200 dark:bg-slate-800"
                  style={{ height: `${20 + ((i * 17) % 70)}%` }}
                />
              ))}
            </div>
          </div>
        </DataPanel>

        {/* 2-Column Grid: Spending Distribution & Debt Breakdown */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12" aria-hidden="true">
          <div className="lg:col-span-6">
            <DataPanel title={t('analytics.chart.spendingDistribution')}>
              <div className="flex h-[200px] items-center justify-center gap-4 p-3">
                <div className="size-[110px] animate-pulse rounded-full border-8 border-slate-200 dark:border-slate-800 shrink-0" />
                <div className="flex flex-1 flex-col gap-2.5">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div
                      key={i}
                      className="h-3 w-full animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800"
                    />
                  ))}
                </div>
              </div>
            </DataPanel>
          </div>

          <div className="lg:col-span-6">
            <DataPanel title={t('analytics.chart.debtBreakdown')}>
              <div className="flex h-[200px] flex-col justify-center gap-3 p-3">
                <div className="flex justify-between">
                  <div className="h-3 w-24 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-24 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex flex-col gap-2 pt-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={i}
                      className="h-3 w-full animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800"
                    />
                  ))}
                </div>
              </div>
            </DataPanel>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top Filter Toolbar */}
      <PeriodFilterToolbar filter={periodFilter} />

      <section aria-label={t('analytics.periodResults.title')}>
        <h2 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          {t('analytics.periodResults.title')}
        </h2>
        <MetricGrid items={periodMetrics} />
      </section>

      <DataPanel title={t('analytics.currentPosition.title')}>
        <MetricGrid items={currentPositionMetrics} />
      </DataPanel>

      {/* Cashflow Trend Panel */}
      <DataPanel
        title={t('analytics.chart.cashflowTrend')}
        toolbar={
          <div className="flex items-center gap-1 max-[640px]:w-full">
            <Button
              onClick={() => setCashflowViewMode('chart')}
              aria-pressed={cashflowViewMode === 'chart'}
              className={`rounded-[3px] border px-2 py-0.5 text-[11px] font-medium ${PHONE_TOGGLE} ${
                cashflowViewMode === 'chart' ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
              }`}
            >
              {t('analytics.tab.allCharts')}
            </Button>
            <Button
              onClick={() => setCashflowViewMode('table')}
              aria-pressed={cashflowViewMode === 'table'}
              className={`rounded-[3px] border px-2 py-0.5 text-[11px] font-medium ${PHONE_TOGGLE} ${
                cashflowViewMode === 'table' ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
              }`}
            >
              {t('analytics.cashflow.breakdownTitle')}
            </Button>
          </div>
        }
      >
        {/* Compact table mode is the edge-to-edge mobile list, so it drops the panel padding. */}
        <div className={cashflowViewMode === 'table' ? 'p-3 max-[960px]:p-0' : 'p-3'}>
          {cashflowViewMode === 'chart' ? (
            <CashflowTrendChart buckets={trendBuckets} height={220} />
          ) : (
            <DataTable
              id="analytics-cashflow-breakdown"
              ariaLabel={t('analytics.cashflow.breakdownTitle')}
              rows={cashflowRows}
              emptyMessage={t('analytics.emptyChartData')}
              columns={cashflowColumns}
              getRowKey={(item) => item.id}
            />
          )}
        </div>
      </DataPanel>

      {/* 2-Column Grid: Spending Distribution & Debt Breakdown */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <DataPanel title={t('analytics.chart.spendingDistribution')}>
            <div className="p-3">
              <CategoryDonutChart
                categories={analyticsQuery.data?.categories ?? []}
                totalAmount={totalExpense}
                height={200}
              />
            </div>
          </DataPanel>
        </div>

        <div className="lg:col-span-6">
          <DataPanel title={t('analytics.chart.debtBreakdown')}>
            <div className="p-3">
              <DebtStructureChart
                debts={
                  analyticsQuery.data?.debts ?? {
                    receivable: rawData.finance.receivable,
                    payable: rawData.finance.payable,
                    netDebt,
                    topReceivables: [],
                    topPayables: [],
                  }
                }
                height={200}
              />
            </div>
          </DataPanel>
        </div>
      </section>
    </div>
  );
}
