'use client';

import { useLocale } from '@/shared/providers/locale-provider';

interface CalendarSummaryStripProps {
  today: number;
  next7Days: number;
  inMonth: number;
  unsynced: number;
  monthLabel: string;
  unsyncedOnly: boolean;
  onToggleUnsynced: () => void;
}

const TILE =
  'flex min-w-0 flex-col gap-0.5 rounded-[3px] border border-slate-200 bg-white px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900 max-[640px]:px-2.5';
const VALUE = 'text-lg leading-6 font-bold text-slate-900 tabular-nums dark:text-slate-100';
const LABEL = 'truncate text-[11px] font-medium text-slate-500 dark:text-slate-400';

/** Counts at a glance; "Not on Google" doubles as a filter for events needing a re-sync. */
export function CalendarSummaryStrip({
  today,
  next7Days,
  inMonth,
  unsynced,
  monthLabel,
  unsyncedOnly,
  onToggleUnsynced,
}: CalendarSummaryStripProps) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-4 gap-2 max-[640px]:grid-cols-2">
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
        <span className={`${LABEL} first-letter:uppercase`}>
          {t('calendar.summary.month')} · {monthLabel}
        </span>
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
