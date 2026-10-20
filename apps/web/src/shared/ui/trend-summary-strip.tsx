'use client';

import { useState, type ReactNode } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/store/money-visibility-store';
import { MicroBarChart, type ChartBucket } from './micro-bar-chart';

interface TrendSummaryStripProps {
  income: number;
  expense: number;
  buckets: ChartBucket[];
  collapsible?: boolean;
  extraMetrics?: ReactNode;
}

export function TrendSummaryStrip({
  income,
  expense,
  buckets,
  collapsible = true,
  extraMetrics,
}: TrendSummaryStripProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();
  const [isExpanded, setIsExpanded] = useState(true);

  const balance = income - expense;

  return (
    <section
      className="grid grid-cols-[minmax(0,1fr)_minmax(280px,380px)] gap-3 rounded border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 max-[900px]:grid-cols-1"
      aria-label={t('chart.incomeVsExpense')}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('dashboard.incomeTotal')}
          </span>
          <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
            {money(income)}
          </strong>
        </article>
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('dashboard.expenseTotal')}
          </span>
          <strong className="mt-0.5 block text-base font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
            {money(expense)}
          </strong>
        </article>
        <article className="flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {t('dashboard.balance')}
          </span>
          <strong
            className={`mt-0.5 block text-base font-bold tabular-nums tracking-tight ${
              balance >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {money(balance)}
          </strong>
        </article>
        {extraMetrics}
      </div>

      <div className="flex flex-col justify-between border-l border-slate-100 pl-3 dark:border-slate-800 max-[900px]:border-t max-[900px]:border-l-0 max-[900px]:pt-2.5 max-[900px]:pl-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-600 uppercase dark:text-slate-400">
            {t('chart.incomeVsExpense')}
          </span>
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400">
              <span className="size-1.5 rounded-full bg-sky-600 dark:bg-sky-500" />
              {t('chart.income')}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
              {t('chart.expense')}
            </span>
          </div>
          {collapsible && (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] border-0 bg-transparent px-1 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? t('chart.toggleHide') : t('chart.toggleShow')}</span>
              <span>{isExpanded ? '▴' : '▾'}</span>
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="relative mt-1">
            <MicroBarChart buckets={buckets} height={70} />
          </div>
        )}
      </div>
    </section>
  );
}
