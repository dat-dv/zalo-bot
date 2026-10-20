'use client';

import { useState, useEffect, useId, useMemo } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import { useCreateTransactionMutation } from '../../api/transactions-query';

export interface AdjustBalanceModalProps {
  isOpen: boolean;
  currentBalance: number;
  onClose: () => void;
  onSuccess?: (message?: string) => void;
}

function getLocalDateTimeString(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function AdjustBalanceModal({
  isOpen,
  currentBalance,
  onClose,
  onSuccess,
}: AdjustBalanceModalProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();
  const titleId = useId();
  const descId = useId();

  const createMutation = useCreateTransactionMutation();

  const [targetAmountInput, setTargetAmountInput] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>(getLocalDateTimeString);
  const [note, setNote] = useState<string>('');
  const [isCustomNote, setIsCustomNote] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize draft when modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetAmountInput(currentBalance.toString());
      setOccurredAt(getLocalDateTimeString());
      setNote('');
      setIsCustomNote(false);
      setErrorMessage(null);
    }
  }, [isOpen, currentBalance]);

  const parsedTargetAmount = useMemo(() => {
    const trimmed = targetAmountInput.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }, [targetAmountInput]);

  const diff = useMemo(() => {
    if (parsedTargetAmount === null) return 0;
    return parsedTargetAmount - currentBalance;
  }, [parsedTargetAmount, currentBalance]);

  // Update default note when target amount changes and user hasn't typed custom note
  useEffect(() => {
    if (!isCustomNote && parsedTargetAmount !== null) {
      const generatedNote = t('transactions.balanceAdjust.defaultNote', {
        current: money(currentBalance),
        target: money(parsedTargetAmount),
      });
      setNote(generatedNote);
    }
  }, [parsedTargetAmount, currentBalance, isCustomNote, money, t]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedTargetAmount === null) {
      setErrorMessage(t('transactions.balanceAdjust.invalidAmount'));
      return;
    }

    if (diff === 0) {
      return;
    }

    const type = diff > 0 ? 'income' : 'expense';
    const amount = Math.abs(diff);
    const category = t('category.balanceAdjustment');
    const finalNote = note.trim() || t('transactions.balanceAdjust.title');
    const isoDate = occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString();

    try {
      setErrorMessage(null);
      await createMutation.mutateAsync({
        type,
        amount,
        category,
        note: finalNote,
        occurredAt: isoDate,
      });

      onSuccess?.(t('transactions.balanceAdjust.success'));
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  return (
    <Modal
      open
      onDismiss={createMutation.isPending ? undefined : onClose}
      dismissOnBackdrop
      labelledBy={titleId}
      describedBy={descId}
      panelClassName="max-w-md rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Modal Header */}
      <header
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950`}
      >
        <div>
          <h3 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('transactions.balanceAdjust.title')}
          </h3>
          <p id={descId} className="text-xs text-slate-500 dark:text-slate-400">
            {t('transactions.balanceAdjust.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          onClick={onClose}
          disabled={createMutation.isPending}
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </header>

      {/* Modal Form */}
      <form onSubmit={handleSubmit} className="space-y-4 p-5 text-xs">
        {/* Current Balance Display */}
        <div className="rounded border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <span className="block text-[11px] font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('transactions.balanceAdjust.currentBalance')}
          </span>
          <strong className="mt-1 block text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {money(currentBalance)}
          </strong>
        </div>

        {/* New Target Balance Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="target-balance-input"
            className="block font-medium text-slate-700 dark:text-slate-300"
          >
            {t('transactions.balanceAdjust.targetBalance')} <span className="text-rose-500">*</span>
          </label>
          <input
            id="target-balance-input"
            type="number"
            step="any"
            required
            value={targetAmountInput}
            onChange={(e) => setTargetAmountInput(e.target.value)}
            placeholder={t('transactions.balanceAdjust.targetPlaceholder')}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 transition-colors focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400"
            disabled={createMutation.isPending}
            autoFocus
          />
        </div>

        {/* Difference & Impact Preview */}
        <div
          className={`rounded border p-3 transition-colors ${
            diff > 0
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : diff < 0
                ? 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400'
          }`}
        >
          <span className="block text-[11px] font-medium tracking-wide uppercase opacity-80">
            {t('transactions.balanceAdjust.difference')}
          </span>
          <p className="mt-1 font-semibold">
            {diff > 0 &&
              t('transactions.balanceAdjust.diffIncrease', { amount: money(Math.abs(diff)) })}
            {diff < 0 &&
              t('transactions.balanceAdjust.diffDecrease', { amount: money(Math.abs(diff)) })}
            {diff === 0 && t('transactions.balanceAdjust.diffZero')}
          </p>
        </div>

        {/* Note Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="adjust-note-input"
            className="block font-medium text-slate-700 dark:text-slate-300"
          >
            {t('transactions.balanceAdjust.note')}
          </label>
          <input
            id="adjust-note-input"
            type="text"
            value={note}
            onChange={(e) => {
              setIsCustomNote(true);
              setNote(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400"
            disabled={createMutation.isPending}
          />
        </div>

        {/* Date & Time Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="adjust-date-input"
            className="block font-medium text-slate-700 dark:text-slate-300"
          >
            {t('transactions.balanceAdjust.date')}
          </label>
          <input
            id="adjust-date-input"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400"
            disabled={createMutation.isPending}
          />
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Modal Footer */}
        <footer
          className={`${MODAL_STICKY_FOOTER} flex items-center justify-end gap-2 border-t border-slate-100 bg-white pt-3 pb-1 dark:border-slate-800 dark:bg-slate-900`}
        >
          <button
            type="button"
            className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            disabled={createMutation.isPending || parsedTargetAmount === null || diff === 0}
          >
            {createMutation.isPending ? t('common.saving') : t('transactions.balanceAdjust.submit')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
