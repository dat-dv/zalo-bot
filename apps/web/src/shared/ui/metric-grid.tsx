import type { ReactNode } from 'react';

export interface MetricGridItem {
  label: ReactNode;
  value: ReactNode;
  valueClassName: string;
}

interface MetricGridProps {
  items: MetricGridItem[];
  className?: string;
}

// Phones: two cards per row and a shorter card, so a 4-metric block fits in one glance.
const CARD_CLASS =
  'flex min-h-[62px] flex-col justify-center rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60 max-[640px]:min-h-[52px] max-[640px]:px-2.5 max-[640px]:py-1.5';
const LABEL_CLASS =
  'block text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400';
const VALUE_CLASS =
  'mt-0.5 block text-base font-bold tabular-nums tracking-tight max-[640px]:text-[14px] max-[640px]:break-words';

export function MetricGrid({ items, className }: MetricGridProps) {
  return (
    <div
      className={
        className ??
        'grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 max-[640px]:grid-cols-2'
      }
    >
      {items.map((item, index) => (
        <article className={CARD_CLASS} key={index}>
          <span className={LABEL_CLASS}>{item.label}</span>
          <strong className={`${VALUE_CLASS} ${item.valueClassName}`}>{item.value}</strong>
        </article>
      ))}
    </div>
  );
}

interface MetricGridSkeletonProps {
  count: number;
  className?: string;
}

export function MetricGridSkeleton({ count, className }: MetricGridSkeletonProps) {
  return (
    <div
      className={
        className ??
        'grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 max-[640px]:grid-cols-2'
      }
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className={CARD_CLASS} key={index}>
          <span className="block h-2.5 w-16 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
          <strong className="mt-2 block h-4 w-24 animate-pulse rounded-[2px] bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
