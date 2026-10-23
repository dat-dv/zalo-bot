'use client';

import { type ReactNode } from 'react';
import { type TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { type PeriodFilterState, type PeriodGrain } from '@/shared/hooks/use-period-filter';
import { Button } from './button';
import { BUTTON_TONE } from './button-styles';

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
      {/* Phones: a native select keeps grain + prev/label/next on one compact row. */}
      <select
        className="hidden h-9 min-h-9 shrink-0 rounded-[3px] border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 max-[640px]:block dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
            className={`min-h-7 shrink-0 rounded-[2px] border px-2 text-xs max-[640px]:min-h-8 max-[640px]:px-2.5 ${
              filter.grain === g
                ? `font-semibold ${BUTTON_TONE.segmentSelected}`
                : `font-medium ${BUTTON_TONE.segment}`
            }`}
            aria-pressed={filter.grain === g}
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
            className={`inline-flex size-7 items-center justify-center rounded-[3px] border p-0 text-base max-[640px]:size-8 ${BUTTON_TONE.secondary}`}
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
            className={`inline-flex size-7 items-center justify-center rounded-[3px] border p-0 text-base max-[640px]:size-8 ${BUTTON_TONE.secondary}`}
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
