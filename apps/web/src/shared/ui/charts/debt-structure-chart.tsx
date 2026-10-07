'use client';

import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import type { IAnalyticsDebtBreakdown } from '@zalobot/contracts';

interface DebtStructureChartProps {
  debts: IAnalyticsDebtBreakdown;
  height?: number;
}

export function DebtStructureChart({ debts, height = 180 }: DebtStructureChartProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();

  const total = debts.receivable + debts.payable;

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-slate-400 italic"
        style={{ height }}
      >
        <span>{t('dashboard.noDebts')}</span>
      </div>
    );
  }

  const receivablePercent = total > 0 ? (debts.receivable / total) * 100 : 0;
  const payablePercent = total > 0 ? (debts.payable / total) * 100 : 0;

  const maxIndividual = Math.max(
    ...debts.topReceivables.map((d: { amount: number }) => d.amount),
    ...debts.topPayables.map((d: { amount: number }) => d.amount),
    1,
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Ratio bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-emerald-700 dark:text-emerald-400">
            {t('analytics.chart.receivables')}: {money(debts.receivable)}
          </span>
          <span className="text-amber-700 dark:text-amber-400">
            {t('analytics.chart.payables')}: {money(debts.payable)}
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 dark:bg-emerald-600"
            style={{ width: `${receivablePercent}%` }}
            title={`${t('analytics.chart.receivables')}: ${receivablePercent.toFixed(1)}%`}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-300 dark:bg-amber-600"
            style={{ width: `${payablePercent}%` }}
            title={`${t('analytics.chart.payables')}: ${payablePercent.toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Top debtors / counterparties */}
      <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
        {/* Receivables List */}
        <div className="flex flex-col gap-1 rounded-[3px] border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
          <span className="text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">
            {t('analytics.chart.receivables')} ({debts.topReceivables.length})
          </span>
          {debts.topReceivables.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">{t('dashboard.noDebts')}</span>
          ) : (
            debts.topReceivables
              .slice(0, 3)
              .map((item: { counterparty: string; amount: number }, idx: number) => (
                <div key={idx} className="flex flex-col gap-0.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                      {item.counterparty}
                    </span>
                    <span className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {money(item.amount)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(item.amount / maxIndividual) * 100}%` }}
                    />
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Payables List */}
        <div className="flex flex-col gap-1 rounded-[3px] border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
          <span className="text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">
            {t('analytics.chart.payables')} ({debts.topPayables.length})
          </span>
          {debts.topPayables.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">{t('dashboard.noDebts')}</span>
          ) : (
            debts.topPayables
              .slice(0, 3)
              .map((item: { counterparty: string; amount: number }, idx: number) => (
                <div key={idx} className="flex flex-col gap-0.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                      {item.counterparty}
                    </span>
                    <span className="font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                      {money(item.amount)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(item.amount / maxIndividual) * 100}%` }}
                    />
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
