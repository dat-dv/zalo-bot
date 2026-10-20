'use client';

import { useState } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/store/money-visibility-store';

export interface ChartBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

interface MicroBarChartProps {
  buckets: ChartBucket[];
  height?: number;
}

export function MicroBarChart({ buckets, height = 76 }: MicroBarChartProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!buckets.length) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-slate-400 italic"
        style={{ height }}
      >
        <span>{t('chart.noData')}</span>
      </div>
    );
  }

  const maxVal = Math.max(...buckets.map((b) => Math.max(b.income, b.expense)), 1);

  const svgWidth = 500;
  const chartHeight = height - 18; // Leave 18px for bottom labels
  const bucketWidth = svgWidth / buckets.length;
  const barWidth = Math.max(Math.min((bucketWidth - 6) / 2, 14), 3);

  const hoveredBucket = hoveredIndex !== null ? buckets[hoveredIndex] : null;

  return (
    <div className="relative w-full" style={{ height }}>
      {hoveredBucket && (
        <div className="pointer-events-none absolute -top-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-[3px] bg-slate-900 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-slate-50 shadow-md dark:bg-slate-800">
          <span className="font-semibold text-slate-400">{hoveredBucket.label}</span>
          <span className="text-sky-400">+ {money(hoveredBucket.income)}</span>
          <span className="text-amber-400">- {money(hoveredBucket.expense)}</span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="size-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Baseline grid */}
        <line
          x1="0"
          y1={chartHeight}
          x2={svgWidth}
          y2={chartHeight}
          strokeDasharray="2 2"
          strokeWidth="1"
          className="stroke-slate-200 dark:stroke-slate-800"
        />

        {buckets.map((bucket, i) => {
          const centerX = i * bucketWidth + bucketWidth / 2;
          const incomeHeight = (bucket.income / maxVal) * (chartHeight - 4);
          const expenseHeight = (bucket.expense / maxVal) * (chartHeight - 4);

          const incomeX = centerX - barWidth - 1;
          const expenseX = centerX + 1;
          const incomeY = chartHeight - incomeHeight;
          const expenseY = chartHeight - expenseHeight;

          return (
            <g
              key={bucket.key}
              className="group cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Invisible touch/hover hit area */}
              <rect
                x={i * bucketWidth}
                y="0"
                width={bucketWidth}
                height={height}
                fill="transparent"
              />

              {/* Income bar */}
              {bucket.income > 0 && (
                <rect
                  x={incomeX}
                  y={incomeY}
                  width={barWidth}
                  height={Math.max(incomeHeight, 2)}
                  rx="1"
                  className="fill-sky-600 opacity-85 transition-opacity group-hover:opacity-100 dark:fill-sky-500"
                />
              )}

              {/* Expense bar */}
              {bucket.expense > 0 && (
                <rect
                  x={expenseX}
                  y={expenseY}
                  width={barWidth}
                  height={Math.max(expenseHeight, 2)}
                  rx="1"
                  className="fill-amber-500 opacity-85 transition-opacity group-hover:opacity-100 dark:fill-amber-400"
                />
              )}

              {/* Label */}
              <text
                x={centerX}
                y={height - 3}
                textAnchor="middle"
                className="fill-slate-400 text-[9px] font-medium dark:fill-slate-500"
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
