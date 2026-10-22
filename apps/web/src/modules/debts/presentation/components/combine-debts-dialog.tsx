'use client';

import { useState, useEffect, useId } from 'react';
import type { IDebtListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  Modal,
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
} from '@/shared/ui/modal';
import { TAP_INPUT } from '@/shared/ui/touch';
import { useMoneyFormatter } from '@/shared/store/money-visibility-store';
import { useCombineDebtsMutation } from '../../api/debts-query';

interface CombineDebtsDialogProps {
  isOpen: boolean;
  selectedDebts: IDebtListItem[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export function CombineDebtsDialog({
  isOpen,
  selectedDebts,
  onClose,
  onSuccess,
}: CombineDebtsDialogProps) {
  const { t } = useLocale();
  const money = useMoneyFormatter();
  const combineMutation = useCombineDebtsMutation();

  const titleId = useId();
  const descId = useId();

  const [note, setNote] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check direction parity
  const firstDirection = selectedDebts[0]?.direction;
  const isMismatched = selectedDebts.some((d) => d.direction !== firstDirection);

  // Check currency parity
  const firstCurrency = (selectedDebts[0]?.currency || 'VND').toUpperCase();
  const isCurrencyMismatched = selectedDebts.some(
    (d) => (d.currency || 'VND').toUpperCase() !== firstCurrency,
  );

  const totalOriginal = selectedDebts.reduce((sum, d) => sum + (Number(d.originalAmount) || 0), 0);
  const totalRemaining = selectedDebts.reduce(
    (sum, d) => sum + (Number(d.remainingAmount) || 0),
    0,
  );

  useEffect(() => {
    if (!isOpen || selectedDebts.length === 0) return;
    setNote(`Gộp từ ${selectedDebts.length} khoản nợ`);
    const defaultDue = selectedDebts.find((d) => Boolean(d.dueAt))?.dueAt;
    setDueDate(defaultDue ? defaultDue.slice(0, 10) : '');
    setErrorMessage(null);
  }, [isOpen, selectedDebts]);

  if (!isOpen || selectedDebts.length < 2) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMismatched) {
      setErrorMessage(t('debts.combineModal.mismatchedDirection'));
      return;
    }
    if (isCurrencyMismatched) {
      setErrorMessage(t('debts.combineModal.mismatchedCurrency'));
      return;
    }

    try {
      setErrorMessage(null);
      await combineMutation.mutateAsync({
        debtIds: selectedDebts.map((d) => d.id),
        note: note.trim() || undefined,
        dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      onSuccess(selectedDebts.length);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('dashboard.error.title'));
    }
  };

  return (
    <Modal
      open
      onDismiss={combineMutation.isPending ? undefined : onClose}
      labelledBy={titleId}
      describedBy={descId}
      backdropClassName="bg-slate-900/50 backdrop-blur-xs"
      phoneLayout="fullscreen"
      panelClassName="max-w-[560px] rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <header
        className={`${MODAL_STICKY_HEADER} flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900`}
      >
        <div>
          <h3
            id={titleId}
            className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {t('debts.combineModal.title')}
          </h3>
          <p id={descId} className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('debts.combineModal.desc')}
          </p>
        </div>
        <button
          type="button"
          className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${MODAL_CLOSE_TAP}`}
          onClick={onClose}
          disabled={combineMutation.isPending}
          aria-label={t('common.close')}
        >
          &times;
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3.5 px-5 py-4">
          {errorMessage && (
            <div
              className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
              role="alert"
            >
              <strong>{errorMessage}</strong>
            </div>
          )}

          {isMismatched && (
            <div
              className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
              role="alert"
            >
              <strong>{t('debts.combineModal.mismatchedDirection')}</strong>
            </div>
          )}

          {isCurrencyMismatched && (
            <div
              className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
              role="alert"
            >
              <strong>{t('debts.combineModal.mismatchedCurrency')}</strong>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('debts.title')} ({selectedDebts.length})
            </span>
            <div className="max-h-40 overflow-y-auto rounded border border-slate-200 dark:border-slate-800 max-sm:max-h-none max-sm:overflow-visible">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 max-sm:static text-[11px] text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5">{t('contacts.placeholder.name')}</th>
                    <th className="px-2.5 py-1.5 text-right">
                      {t('debts.placeholder.originalAmount')}
                    </th>
                    <th className="px-2.5 py-1.5 text-right">
                      {t('debts.placeholder.remainingAmount')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {selectedDebts.map((debt) => (
                    <tr key={debt.id} className="text-slate-700 dark:text-slate-300">
                      <td className="px-2.5 py-1.5">
                        <span className="font-medium">{debt.counterparty}</span>
                        {debt.counterpartyAlias ? (
                          <span className="text-slate-400"> ({debt.counterpartyAlias})</span>
                        ) : null}
                        {debt.note ? (
                          <div className="truncate text-[11px] text-slate-400">{debt.note}</div>
                        ) : null}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono">
                        {money(debt.originalAmount)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono font-semibold">
                        {money(debt.remainingAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Combined Totals Preview */}
          <div className="grid grid-cols-2 gap-2 rounded border border-slate-200 bg-slate-50/50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/40">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('debts.placeholder.originalAmount')} (
                {t('debts.badge.parent', { count: selectedDebts.length })})
              </span>
              <p className="m-0 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                {money(totalOriginal)}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('debts.placeholder.remainingAmount')} (
                {t('debts.badge.parent', { count: selectedDebts.length })})
              </span>
              <p className="m-0 font-mono text-sm font-semibold text-sky-600 dark:text-sky-400">
                {money(totalRemaining)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="combine-debt-note"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('debts.combineModal.parentNote')}
            </label>
            <input
              id="combine-debt-note"
              type="text"
              className={`h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${TAP_INPUT}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('debts.placeholder.note')}
              disabled={combineMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="combine-debt-due-date"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('debts.combineModal.parentDueDate')}
            </label>
            <input
              id="combine-debt-due-date"
              type="date"
              className={`h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 ${TAP_INPUT}`}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={combineMutation.isPending}
            />
          </div>

          <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <span className="shrink-0" aria-hidden="true">
              ⚠️
            </span>
            <p className="m-0 leading-normal">{t('debts.combineModal.warning')}</p>
          </div>
        </div>

        <footer
          className={`${MODAL_STICKY_FOOTER} flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950`}
        >
          <button
            type="button"
            className={`inline-flex min-h-8 items-center justify-center rounded border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${MODAL_FOOTER_TAP}`}
            onClick={onClose}
            disabled={combineMutation.isPending}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className={`inline-flex min-h-8 items-center justify-center rounded border border-slate-900 bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${MODAL_FOOTER_TAP}`}
            disabled={combineMutation.isPending || isMismatched || isCurrencyMismatched}
          >
            {combineMutation.isPending
              ? t('common.loadingDashboard')
              : t('debts.combineModal.confirm')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
