'use client';

import { useLocale } from '@/shared/providers/locale-provider';

interface MaskedChartPlaceholderProps {
  height: number;
}

/** Stands in for a chart while amounts are hidden, at the chart's height so the layout stays put. */
export function MaskedChartPlaceholder({ height }: MaskedChartPlaceholderProps) {
  const { t } = useLocale();

  return (
    <div
      className="flex items-center justify-center text-[11px] text-slate-400 italic"
      style={{ height }}
    >
      <span>{t('chart.hiddenWhileMasked')}</span>
    </div>
  );
}
