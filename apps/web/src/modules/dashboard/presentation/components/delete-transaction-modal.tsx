'use client';

import { useEffect, useId, useCallback } from 'react';
import { localeTag, type ITransactionItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';

export interface DeleteTransactionModalProps {
  isOpen: boolean;
  transaction: ITransactionItem | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void> | void;
  isPending?: boolean;
}

export function DeleteTransactionModal({
  isOpen,
  transaction,
  onClose,
  onConfirm,
  isPending = false,
}: DeleteTransactionModalProps) {
  const { t, locale } = useLocale();
  const money = useMoneyFormatter();
  const titleId = useId();
  const descId = useId();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onClose();
      }
    },
    [isPending, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !transaction) return null;

  const isExpense = transaction.type === 'expense';
  const hasAllocations = Boolean(transaction.allocations && transaction.allocations.length > 0);
  const formattedDate = transaction.occurredAt
    ? new Intl.DateTimeFormat(localeTag(locale), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(transaction.occurredAt))
    : '';

  const handleConfirm = () => {
    if (isPending) return;
    void onConfirm(transaction.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity dark:bg-slate-950/80"
        onClick={isPending ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        {/* Modal Header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div>
            <h3 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('transactions.deleteModal.title')}
            </h3>
            <p id={descId} className="text-xs text-slate-500 dark:text-slate-400">
              {t('transactions.deleteModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            onClick={onClose}
            disabled={isPending}
            aria-label={t('transactions.actions.cancel')}
          >
            ✕
          </button>
        </header>

        {/* Modal Body */}
        <div className="space-y-4 p-5 text-xs text-slate-700 dark:text-slate-300">
          {/* Transaction Summary Card */}
          <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[10px] font-semibold select-none ${
                    transaction.type === 'income'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {transaction.type === 'income'
                    ? t('table.filter.income')
                    : t('table.filter.expense')}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {transaction.category}
                </span>
                {transaction.placeName && (
                  <span className="text-slate-500 dark:text-slate-400">
                    📍 {transaction.placeName}
                  </span>
                )}
              </div>
              <strong
                className={`tabular-nums text-sm font-bold ${
                  transaction.type === 'income'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {transaction.type === 'income' ? '+' : '-'} {money(transaction.amount)}
              </strong>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400">
              <span>{transaction.note || '—'}</span>
              <span className="font-mono">{formattedDate}</span>
            </div>
          </div>

          {/* Balance Impact Alert Card */}
          {isExpense ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">💰</span>
                <div>
                  <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">
                    {t('transactions.deleteModal.impactExpenseRefund', {
                      amount: money(transaction.amount),
                    })}
                  </h4>
                  <p className="mt-1 text-[11.5px] text-emerald-700 dark:text-emerald-400">
                    {t('transactions.deleteModal.impactExpenseExplain')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300">
                    {t('transactions.deleteModal.impactIncomeDeduct', {
                      amount: money(transaction.amount),
                    })}
                  </h4>
                  <p className="mt-1 text-[11.5px] text-amber-700 dark:text-amber-400">
                    {t('transactions.deleteModal.impactIncomeExplain')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Debt Allocations Revert Warning */}
          {hasAllocations && (
            <div className="rounded-md border border-rose-200 bg-rose-50/70 p-3 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">🔗</span>
                <div>
                  <h4 className="font-semibold text-rose-800 dark:text-rose-300">
                    {t('transactions.deleteModal.allocationsWarning', {
                      count: transaction.allocations?.length ?? 0,
                    })}
                  </h4>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/30">
          <button
            type="button"
            className="cursor-pointer rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={onClose}
            disabled={isPending}
          >
            {t('transactions.actions.cancel')}
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? '...' : t('transactions.deleteModal.confirmAction')}
          </button>
        </footer>
      </div>
    </div>
  );
}
