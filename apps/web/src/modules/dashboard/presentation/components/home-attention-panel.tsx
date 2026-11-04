'use client';

import Link from 'next/link';
import type { TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import type { HomeAttentionKind, HomeAttentionRow } from '../../model/home-attention';

export const HOME_ATTENTION_ID = 'home-attention';

const ATTENTION_LABEL_KEYS: Record<HomeAttentionKind, TranslationKey> = {
  overdueTasks: 'dashboard.attention.overdueTasks',
  tasksDueToday: 'dashboard.attention.tasksDueToday',
  debtsDue: 'dashboard.attention.debtsDue',
  recurringPending: 'dashboard.attention.recurringPending',
};

/** What the attention card counts, with a way to each place. No row, no panel: the card says so. */
export function HomeAttentionPanel({ rows }: { rows: readonly HomeAttentionRow[] }) {
  const { t } = useLocale();
  if (rows.length === 0) return null;

  return (
    <div id={HOME_ATTENTION_ID} className="scroll-mt-16">
      <DataPanel title={t('dashboard.attentionItems')}>
        <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {rows.map((row) => (
            <li key={row.kind}>
              <Link
                href={row.href}
                className="flex min-h-11 items-center gap-2.5 px-3 py-1.5 text-[12.5px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <strong className="w-6 shrink-0 text-right font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {row.count}
                </strong>
                <span className="flex min-w-0 flex-1 items-baseline gap-2 max-[640px]:flex-col max-[640px]:gap-0">
                  <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                    {t(ATTENTION_LABEL_KEYS[row.kind])}
                  </span>
                  <span className="min-w-0 max-w-full truncate text-slate-600 dark:text-slate-400">
                    {row.firstTitle}
                  </span>
                </span>
                <span className="shrink-0 text-slate-400" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </DataPanel>
    </div>
  );
}
