'use client';

import { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import type { IAnalyticsCategoryBreakdown } from '@zalobot/contracts';

interface CategoryDonutChartProps {
  categories: IAnalyticsCategoryBreakdown[];
  totalAmount?: number;
  height?: number;
}

const PALETTE = [
  '#0284c7', // sky-600
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#64748b', // slate-500
];

interface SliceItem {
  label: string;
  amount: number;
  percentage: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: SliceItem;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  const money = useMoneyFormatter();
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="z-50 flex min-w-[150px] flex-col gap-1 rounded-[4px] border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
        <span className="size-2 rounded-xs" style={{ backgroundColor: data.color }} />
        {data.label}
      </div>
      <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
        <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
          {money(data.amount)}
        </span>
        <span className="text-[10px] text-slate-400">({data.percentage.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

export function CategoryDonutChart({
  categories,
  totalAmount,
  height = 180,
}: CategoryDonutChartProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.amount > 0);
  const sum = totalAmount ?? expenseCategories.reduce((acc, c) => acc + c.amount, 0);

  if (!expenseCategories.length || sum <= 0) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-slate-400 italic"
        style={{ height }}
      >
        <span>{t('analytics.emptyChartData')}</span>
      </div>
    );
  }

  const slices: SliceItem[] = expenseCategories.map((c, i) => ({
    label: c.category,
    amount: c.amount,
    percentage: sum > 0 ? (c.amount / sum) * 100 : 0,
    color: c.color || PALETTE[i % PALETTE.length],
  }));

  const categoryTotal = expenseCategories.reduce((acc, c) => acc + c.amount, 0);
  const diff = sum - categoryTotal;
  if (diff > 0.5) {
    slices.push({
      label: t('common.allCategories'),
      amount: diff,
      percentage: sum > 0 ? (diff / sum) * 100 : 0,
      color: PALETTE[slices.length % PALETTE.length],
    });
  }

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3 max-[480px]:grid-cols-1">
      {/* Recharts Donut Pie */}
      <div className="relative flex size-[130px] items-center justify-center self-center max-[480px]:mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none', zIndex: 1000 }} />
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={54}
              paddingAngle={2}
              onMouseEnter={(_, index) => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {slices.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                  className="cursor-pointer transition-opacity"
                  opacity={hoveredIdx === null || hoveredIdx === index ? 1 : 0.6}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[70px] truncate text-[9px] font-semibold text-slate-400 uppercase">
            {activeSlice ? activeSlice.label : t('dashboard.columns.category')}
          </span>
          <strong className="text-[11px] font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {activeSlice ? `${activeSlice.percentage.toFixed(1)}%` : `${slices.length}`}
          </strong>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex flex-col justify-center gap-1.5 overflow-hidden">
        <div className="mb-0.5 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>{t('analytics.topCategories')}</span>
          <span className="tabular-nums">{money(sum)}</span>
        </div>
        <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto pr-1">
          {slices.map((slice, idx) => (
            <div
              key={slice.label}
              className={`group flex cursor-pointer flex-col gap-0.5 rounded px-1.5 py-0.5 text-xs transition-colors ${
                hoveredIdx === idx
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="size-2 shrink-0 rounded-xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {slice.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {money(slice.amount)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({slice.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              {/* Progress track */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(slice.percentage, 100)}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
