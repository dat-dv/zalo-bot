'use client';

import { useState, useEffect, useId, useMemo } from 'react';
import { localeTag, type ICandidateDebtItem, type IDebtAllocationItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyFormatter } from '@/shared/providers/money-visibility-provider';
import {
  useCandidateDebtsQuery,
  useTransactionAllocationsQuery,
  useAllocateTransactionMutation,
} from '../../api/allocations-query';
import type { TransactionTableItem } from './transactions-table';

const EMPTY_CANDIDATE_DEBTS: ICandidateDebtItem[] = [];
const EMPTY_ALLOCATIONS: IDebtAllocationItem[] = [];

export interface DebtAllocationModalProps {
  isOpen: boolean;
  transaction: TransactionTableItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DebtAllocationModal({
  isOpen,
  transaction,
  onClose,
  onSuccess,
}: DebtAllocationModalProps) {
  const { t, locale } = useLocale();
  const money = useMoneyFormatter();
  const titleId = useId();

  const transactionId = transaction?.id || null;

  const { data: candidates = EMPTY_CANDIDATE_DEBTS, isLoading: isLoadingCandidates } =
    useCandidateDebtsQuery(transactionId);
  const { data: existingAllocations = EMPTY_ALLOCATIONS, isLoading: isLoadingExisting } =
    useTransactionAllocationsQuery(transactionId);
  const allocateMutation = useAllocateTransactionMutation();

  // Allocation draft states: map of debtId -> amount (number) and note (string)
  const [allocatedAmounts, setAllocatedAmounts] = useState<Record<string, number>>({});
  const [allocatedNotes, setAllocatedNotes] = useState<Record<string, string>>({});
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize draft when modal opens or existingAllocations load
  useEffect(() => {
    if (!isOpen || !transaction) {
      setSelectedDebtIds(new Set());
      setAllocatedAmounts({});
      setAllocatedNotes({});
      setErrorMessage(null);
      return;
    }

    if (existingAllocations.length > 0) {
      const selected = new Set<string>();
      const amounts: Record<string, number> = {};
      const notes: Record<string, string> = {};

      for (const alloc of existingAllocations) {
        selected.add(alloc.debtId);
        amounts[alloc.debtId] = alloc.amount;
        if (alloc.note) {
          notes[alloc.debtId] = alloc.note;
        }
      }

      setSelectedDebtIds(selected);
      setAllocatedAmounts(amounts);
      setAllocatedNotes(notes);
    } else {
      setSelectedDebtIds(new Set());
      setAllocatedAmounts({});
      setAllocatedNotes({});
    }
    setErrorMessage(null);
  }, [isOpen, transaction, existingAllocations]);

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !allocateMutation.isPending) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allocateMutation.isPending, onClose]);

  // Calculate sum of currently entered allocations
  const totalAllocated = useMemo(() => {
    let sum = 0;
    for (const debtId of selectedDebtIds) {
      const amount = allocatedAmounts[debtId] || 0;
      sum += amount;
    }
    return sum;
  }, [selectedDebtIds, allocatedAmounts]);

  const transactionAmount = transaction?.amount || 0;
  const remainingUnallocated = transactionAmount - totalAllocated;

  if (!isOpen || !transaction) return null;

  const handleToggleDebt = (debt: ICandidateDebtItem) => {
    setSelectedDebtIds((prev) => {
      const next = new Set(prev);
      if (next.has(debt.id)) {
        next.delete(debt.id);
        setAllocatedAmounts((prevAmounts) => {
          const { [debt.id]: _removed, ...nextAmounts } = prevAmounts;
          return nextAmounts;
        });
      } else {
        next.add(debt.id);
        // Default allocate remaining unallocated or debt remaining amount
        const defaultAmount = Math.max(0, Math.min(remainingUnallocated, debt.remainingAmount));
        setAllocatedAmounts((prevAmounts) => ({
          ...prevAmounts,
          [debt.id]: defaultAmount,
        }));
      }
      return next;
    });
    setErrorMessage(null);
  };

  const handleAmountChange = (debtId: string, value: string) => {
    const numeric = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    setAllocatedAmounts((prev) => ({
      ...prev,
      [debtId]: numeric,
    }));
    setErrorMessage(null);
  };

  const handleQuickAllocateMax = (debt: ICandidateDebtItem) => {
    const currentDebtAllocated = allocatedAmounts[debt.id] || 0;
    const maxAvailable = remainingUnallocated + currentDebtAllocated;
    const maxPossible = Math.min(maxAvailable, debt.remainingAmount);

    setSelectedDebtIds((prev) => new Set(prev).add(debt.id));
    setAllocatedAmounts((prev) => ({
      ...prev,
      [debt.id]: Math.max(0, maxPossible),
    }));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    if (totalAllocated > transaction.amount) {
      setErrorMessage(t('transactions.allocation.exceededAmount'));
      return;
    }

    const allocations = Array.from(selectedDebtIds)
      .map((debtId) => ({
        debtId,
        amount: allocatedAmounts[debtId] || 0,
        note: allocatedNotes[debtId]?.trim() || undefined,
      }))
      .filter((a) => a.amount > 0);

    for (const alloc of allocations) {
      const candidate = candidates.find((c) => c.id === alloc.debtId);
      if (candidate && alloc.amount > candidate.remainingAmount) {
        setErrorMessage(t('transactions.allocation.exceededDebtRemaining'));
        return;
      }
    }

    try {
      setErrorMessage(null);
      await allocateMutation.mutateAsync({
        transactionId: transaction.id,
        data: { allocations },
      });
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message || t('transactions.allocation.exceededAmount'));
    }
  };

  const isIncome = transaction.type === 'income';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
            >
              <span>🔗</span> {t('transactions.allocation.title')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isIncome
                ? t('transactions.allocation.modalSubtitleIncome')
                : t('transactions.allocation.modalSubtitleExpense')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={allocateMutation.isPending}
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={t('common.cancel')}
          >
            ✕
          </button>
        </div>

        {/* Source Transaction Details Banner */}
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                  isIncome
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {isIncome ? '↓ THU' : '↑ CHI'}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {transaction.category}
              </span>
              {transaction.placeName && (
                <span className="text-slate-500 dark:text-slate-400">
                  · 📍 {transaction.placeName}
                </span>
              )}
              {transaction.note && (
                <span className="text-slate-500 dark:text-slate-400">· {transaction.note}</span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              📅{' '}
              {new Intl.DateTimeFormat(localeTag(locale), {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(transaction.occurredAt))}
            </div>
          </div>

          {/* Amount Allocation Progress Bar */}
          <div className="mt-3 flex items-center justify-between rounded border border-slate-200 bg-white p-2.5 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-950">
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.allocation.totalAmount')}:{' '}
              </span>
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {money(transaction.amount)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.allocation.allocated')}:{' '}
              </span>
              <strong className="font-semibold text-sky-600 dark:text-sky-400">
                {money(totalAllocated)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.allocation.unallocated')}:{' '}
              </span>
              <strong
                className={`font-semibold ${
                  remainingUnallocated < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : remainingUnallocated === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {money(remainingUnallocated)}
              </strong>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {errorMessage && (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              ⚠️ {errorMessage}
            </div>
          )}

          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Danh sách công nợ phù hợp ({candidates.length})
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {isLoadingCandidates || isLoadingExisting ? (
              <div className="space-y-2 py-4 text-center text-xs text-slate-400">
                Đang tải danh sách công nợ...
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {t('transactions.allocation.noCandidates')}
              </div>
            ) : (
              candidates.map((debt) => {
                const isSelected = selectedDebtIds.has(debt.id);
                const currentAmount = allocatedAmounts[debt.id] ?? 0;
                const noteValue = allocatedNotes[debt.id] ?? '';

                return (
                  <div
                    key={debt.id}
                    className={`rounded-md border p-3 text-xs transition-colors ${
                      isSelected
                        ? 'border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleDebt(debt)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{debt.counterparty}</span>
                            {debt.counterpartyAlias && (
                              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                ({debt.counterpartyAlias})
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Nợ gốc: {money(debt.originalAmount)} · Còn lại:{' '}
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {money(debt.remainingAmount)}
                            </span>
                            {debt.note && <span> · {debt.note}</span>}
                          </div>
                        </div>
                      </label>

                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => handleQuickAllocateMax(debt)}
                          className="shrink-0 cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Phân bổ tối đa
                        </button>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200/60 pt-2.5 dark:border-slate-800/60">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Số tiền phân bổ (VND)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={debt.remainingAmount}
                            step="1000"
                            value={currentAmount || ''}
                            onChange={(e) => handleAmountChange(debt.id, e.target.value)}
                            placeholder="0"
                            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('transactions.allocation.noteOptional')}
                          </label>
                          <input
                            type="text"
                            value={noteValue}
                            onChange={(e) =>
                              setAllocatedNotes((prev) => ({
                                ...prev,
                                [debt.id]: e.target.value,
                              }))
                            }
                            placeholder={t('debts.placeholder.note')}
                            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Actions Footer */}
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={allocateMutation.isPending}
              className="cursor-pointer rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={
                allocateMutation.isPending ||
                isLoadingCandidates ||
                totalAllocated > transaction.amount
              }
              className="cursor-pointer rounded-[4px] border border-sky-600 bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              {allocateMutation.isPending
                ? t('common.saving')
                : t('transactions.allocation.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
