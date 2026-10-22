'use client';

import { useId, useState, type ReactNode } from 'react';
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
  // Phones start collapsed: the totals line is enough to read before the list.
  const [isPhoneExpanded, setIsPhoneExpanded] = useState(false);
  const phoneChartId = useId();

  const balance = income - expense;
  const balanceClass =
    balance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const isPhoneChartShown = !collapsible || isPhoneExpanded;
  const phoneTotals = (
    <span className="grid min-w-0 flex-1 grid-cols-3 gap-2">
      <PhoneTotal
        label={t('dashboard.incomeTotal')}
        value={money(income)}
        valueClassName="text-emerald-700 dark:text-emerald-400"
      />
      <PhoneTotal
        label={t('dashboard.expenseTotal')}
        value={money(expense)}
        valueClassName="text-amber-700 dark:text-amber-400"
      />
      <PhoneTotal
        label={t('dashboard.balance')}
        value={money(balance)}
        valueClassName={balanceClass}
      />
    </span>
  );

  return (
    <>
      {/* Phones: one compact totals line; tapping it reveals the chart (and any extra metrics). */}
      <section
        className="hidden rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 max-[640px]:block"
        aria-label={t('chart.incomeVsExpense')}
      >
        {collapsible ? (
          <button
            type="button"
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-0 !bg-transparent px-2.5 py-1.5 text-left"
            onClick={() => setIsPhoneExpanded((prev) => !prev)}
            aria-expanded={isPhoneExpanded}
            aria-controls={phoneChartId}
          >
            {phoneTotals}
            <span className="sr-only">
              {isPhoneExpanded ? t('chart.toggleHide') : t('chart.toggleShow')}
            </span>
            <span
              aria-hidden="true"
              className={`shrink-0 text-[11px] text-slate-500 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:text-slate-400 ${isPhoneExpanded ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>
        ) : (
          <div className="flex min-h-11 items-center px-2.5 py-1.5">{phoneTotals}</div>
        )}
        {/* Always mounted so the height can ease open/closed (0fr ↔ 1fr grid rows). */}
        <div
          id={phoneChartId}
          inert={!isPhoneChartShown}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPhoneChartShown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="flex min-h-0 flex-col gap-2 overflow-hidden border-t border-slate-100 px-2.5 pt-1.5 pb-2 dark:border-slate-800">
            {extraMetrics && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                {extraMetrics}
              </div>
            )}
            <MicroBarChart buckets={buckets} height={70} />
          </div>
        </div>
      </section>

      <section
        className="grid grid-cols-[minmax(0,1fr)_minmax(280px,380px)] gap-3 rounded border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 max-[900px]:grid-cols-1 max-[640px]:hidden"
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
              className={`mt-0.5 block text-base font-bold tabular-nums tracking-tight ${balanceClass}`}
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
    </>
  );
}

function PhoneTotal({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </span>
      <strong
        className={`truncate text-[13px] font-bold tabular-nums tracking-tight ${valueClassName}`}
      >
        {value}
      </strong>
    </span>
  );
}
