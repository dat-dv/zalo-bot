'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import type { IAnalyticsTrendBucket } from '@zalobot/contracts';

interface CashflowTrendChartProps {
  buckets: IAnalyticsTrendBucket[];
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string;
    value?: number;
    payload?: IAnalyticsTrendBucket;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();

  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const netCashflow =
    typeof data.netCashflow === 'number' ? data.netCashflow : data.income - data.expense;
  const isNetPos = netCashflow >= 0;
  const isBalancePos = data.balance >= 0;

  return (
    <div className="z-50 flex min-w-[200px] flex-col gap-1.5 rounded-[4px] border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 pb-1.5 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-200">
        {data.label}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
            <span className="size-2 rounded-xs bg-sky-500" />
            {t('chart.income')}:
          </span>
          <span className="font-medium tabular-nums text-sky-700 dark:text-sky-400">
            + {money(data.income)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="size-2 rounded-xs bg-amber-500" />
            {t('chart.expense')}:
          </span>
          <span className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
            - {money(data.expense)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="size-2 rounded-xs bg-slate-400" />
            {t('analytics.chart.netCashflow')}:
          </span>
          <span
            className={`font-medium tabular-nums ${
              isNetPos
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isNetPos ? '+ ' : ''}
            {money(netCashflow)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1.5 dark:border-slate-800">
          <span className="flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-400">
            <span className="size-2 rounded-xs bg-violet-500" />
            {t('analytics.chart.walletBalance')}:
          </span>
          <span
            className={`font-bold tabular-nums ${
              isBalancePos
                ? 'text-violet-700 dark:text-violet-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {money(data.balance)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CashflowTrendChart({ buckets, height = 220 }: CashflowTrendChartProps) {
  const { t } = useLocale();

  if (!buckets.length) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-slate-400 italic"
        style={{ height }}
      >
        <span>{t('analytics.emptyChartData')}</span>
      </div>
    );
  }

  // Format short axis currency (e.g. 1M, 500k)
  const formatYAxis = (val: number) => {
    if (val === 0) return '0';
    const abs = Math.abs(val);
    if (abs >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
    }
    if (abs >= 1_000) {
      return `${(val / 1_000).toFixed(0)}k`;
    }
    return String(val);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Legend header */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-400">
          <span className="size-2 rounded-xs bg-sky-500" />
          {t('chart.income')}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
          <span className="size-2 rounded-xs bg-amber-500" />
          {t('chart.expense')}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-400">
          <span className="inline-block h-0.5 w-3.5 bg-violet-500 rounded-full" />
          {t('analytics.chart.walletBalance')}
        </span>
      </div>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-slate-200/70 dark:stroke-slate-800/70"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              className="fill-slate-500 dark:fill-slate-400"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={formatYAxis}
              className="fill-slate-500 dark:fill-slate-400"
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
              wrapperStyle={{ outline: 'none', zIndex: 1000 }}
            />
            <Bar
              dataKey="income"
              name={t('chart.income')}
              fill="#0284c7"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="expense"
              name={t('chart.expense')}
              fill="#f59e0b"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
            <Line
              type="monotone"
              dataKey="balance"
              name={t('analytics.chart.walletBalance')}
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#8b5cf6' }}
              activeDot={{ r: 4.5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
