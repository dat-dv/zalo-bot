'use client';

import { type ReactNode } from 'react';
import { type TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { type PeriodFilterState, type PeriodGrain } from '@/shared/hooks/use-period-filter';
import { Button } from './button';

interface PeriodFilterToolbarProps {
  filter: PeriodFilterState;
  grains?: PeriodGrain[];
  children?: ReactNode;
}

const DEFAULT_GRAINS: PeriodGrain[] = ['week', 'month', 'quarter', 'year'];

const GRAIN_LABELS: Record<PeriodGrain, TranslationKey> = {
  day: 'period.day',
  week: 'period.week',
  month: 'period.month',
  quarter: 'period.quarter',
  year: 'period.year',
  all: 'period.all',
};

export function PeriodFilterToolbar({
  filter,
  grains = DEFAULT_GRAINS,
  children,
}: PeriodFilterToolbarProps) {
  const { t } = useLocale();
  const isAll = filter.grain === 'all';

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar">
      {/* Phones: a native select keeps grain + prev/label/next on one 40px row. */}
      <select
        className="hidden h-10 min-h-10 shrink-0 rounded-[3px] border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 max-[640px]:block dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        aria-label={t('period.grain')}
        value={filter.grain}
        onChange={(event) => {
          const next = grains.find((g) => g === event.target.value);
          if (next) filter.setGrain(next);
        }}
      >
        {grains.map((g) => (
          <option key={g} value={g}>
            {t(GRAIN_LABELS[g])}
          </option>
        ))}
      </select>
      <div
        className="inline-flex rounded-[3px] border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900 max-[640px]:hidden"
        role="group"
      >
        {grains.map((g) => (
          <Button
            key={g}
            type="button"
            className={
              filter.grain === g
                ? 'min-h-7 shrink-0 rounded-[2px] max-[640px]:min-h-10 max-[640px]:px-3 !border border-slate-200/80 !bg-white px-2 text-xs font-semibold !text-slate-900 shadow-xs dark:!border-transparent dark:!bg-slate-800 dark:!text-slate-100'
                : 'min-h-7 shrink-0 rounded-[2px] max-[640px]:min-h-10 max-[640px]:px-3 !border-0 !bg-transparent px-2 text-xs font-medium text-slate-600 hover:!bg-white/80 hover:!text-slate-900 dark:!text-slate-300 dark:hover:!bg-slate-800/80 dark:hover:!text-slate-100'
            }
            onClick={() => filter.setGrain(g)}
          >
            {t(GRAIN_LABELS[g])}
          </Button>
        ))}
      </div>

      {!isAll ? (
        <div className="flex items-center gap-1 max-[640px]:min-w-0 max-[640px]:flex-1">
          <Button
            type="button"
            className="inline-flex size-7 max-[640px]:size-10 items-center justify-center rounded-[3px] border border-slate-300 !bg-white !p-0 text-base text-slate-600 hover:!bg-slate-100 dark:border-slate-600 dark:!bg-slate-800 dark:!text-slate-200 dark:hover:!bg-slate-700"
            onClick={filter.prevPeriod}
            aria-label={t('period.prev')}
            title={t('period.prev')}
          >
            ‹
          </Button>
          <span className="min-w-24 text-center text-xs font-medium text-slate-700 max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:truncate dark:text-slate-200">
            {filter.label}
          </span>
          <Button
            type="button"
            className="inline-flex size-7 max-[640px]:size-10 items-center justify-center rounded-[3px] border border-slate-300 !bg-white !p-0 text-base text-slate-600 hover:!bg-slate-100 dark:border-slate-600 dark:!bg-slate-800 dark:!text-slate-200 dark:hover:!bg-slate-700"
            onClick={filter.nextPeriod}
            aria-label={t('period.next')}
            title={t('period.next')}
          >
            ›
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="min-w-24 text-center text-xs font-medium text-slate-700 dark:text-slate-200">
            {filter.label}
          </span>
        </div>
      )}

      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
