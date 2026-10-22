'use client';

import { useLocale } from '@/shared/providers/locale-provider';

interface CalendarSummaryStripProps {
  today: number;
  next7Days: number;
  inMonth: number;
  unsynced: number;
  unsyncedOnly: boolean;
  onToggleUnsynced: () => void;
}

const TILE =
  'flex min-w-0 flex-col gap-0.5 rounded-[3px] border border-slate-200 bg-white px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900 max-[640px]:gap-0 max-[640px]:px-2 max-[640px]:py-1.5';
const VALUE =
  'text-lg leading-6 font-bold text-slate-900 tabular-nums dark:text-slate-100 max-[640px]:text-base max-[640px]:leading-5';
// Phones keep all four tiles on one row, so labels may wrap to two short lines.
const LABEL =
  'truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 max-[640px]:text-[10.5px] max-[640px]:leading-tight max-[640px]:whitespace-normal';

/** Counts at a glance; "Not on Google" doubles as a filter for events needing a re-sync. */
export function CalendarSummaryStrip({
  today,
  next7Days,
  inMonth,
  unsynced,
  unsyncedOnly,
  onToggleUnsynced,
}: CalendarSummaryStripProps) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-4 gap-2 max-[640px]:gap-1.5">
      <div className={TILE}>
        <span className={VALUE}>{today}</span>
        <span className={LABEL}>{t('calendar.summary.today')}</span>
      </div>
      <div className={TILE}>
        <span className={VALUE}>{next7Days}</span>
        <span className={LABEL}>{t('calendar.summary.next7')}</span>
      </div>
      <div className={TILE}>
        <span className={VALUE}>{inMonth}</span>
        <span className={LABEL}>{t('calendar.summary.month')}</span>
      </div>
      <button
        type="button"
        onClick={onToggleUnsynced}
        aria-pressed={unsyncedOnly}
        disabled={unsynced === 0 && !unsyncedOnly}
        className={`${TILE} cursor-pointer transition-colors disabled:cursor-default ${
          unsyncedOnly
            ? '!border-amber-400 !bg-amber-50 dark:!border-amber-700 dark:!bg-amber-950/40'
            : unsynced > 0
              ? 'hover:border-amber-300 hover:bg-amber-50/60 dark:hover:border-amber-800'
              : ''
        }`}
      >
        <span className={`${VALUE} ${unsynced > 0 ? '!text-amber-700 dark:!text-amber-400' : ''}`}>
          {unsynced}
        </span>
        <span className={LABEL}>{t('calendar.summary.unsynced')}</span>
      </button>
    </div>
  );
}
