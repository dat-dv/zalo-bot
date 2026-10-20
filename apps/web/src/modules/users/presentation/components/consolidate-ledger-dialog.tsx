'use client';

import { useId, useState } from 'react';
import type {
  ILedgerConsolidateResult,
  ILedgerDataCounts,
  ILedgerInfo,
  TranslationKey,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import { useConsolidateLedgerMutation } from '../../api/users-query';
import { apiErrorMessage } from '../../api/api-error-message';

interface ConsolidateLedgerDialogProps {
  ledger: ILedgerInfo;
  onClose: () => void;
  onConsolidated: (result: ILedgerConsolidateResult) => void;
}

const COUNT_LABEL_KEYS: Record<keyof ILedgerDataCounts, TranslationKey> = {
  transactions: 'ledger.counts.transactions',
  places: 'ledger.counts.places',
  contacts: 'ledger.counts.contacts',
  debts: 'ledger.counts.debts',
  categories: 'ledger.counts.categories',
};

const COUNT_KEYS = Object.keys(COUNT_LABEL_KEYS) as (keyof ILedgerDataCounts)[];

export function ConsolidateLedgerDialog({
  ledger,
  onClose,
  onConsolidated,
}: ConsolidateLedgerDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const descId = useId();
  const consolidateMutation = useConsolidateLedgerMutation();
  const [submitError, setSubmitError] = useState('');

  const isPending = consolidateMutation.isPending;
  const ownerLabel = ledger.ownerName || ledger.ownerUserId || '';
  const canConsolidate = Boolean(ledger.ownerUserId) && ledger.sources.length > 0 && !isPending;

  const handleConfirm = async () => {
    if (!canConsolidate) return;
    setSubmitError('');
    try {
      const result = await consolidateMutation.mutateAsync();
      onConsolidated(result);
    } catch (error: unknown) {
      setSubmitError(apiErrorMessage(error));
    }
  };

  return (
    <Modal
      open
      onDismiss={isPending ? undefined : onClose}
      labelledBy={titleId}
      describedBy={descId}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="max-w-lg rounded-2xl border border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between bg-white pt-6 pb-3 dark:bg-slate-900`}
      >
        <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('ledger.consolidate.title')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          aria-label={t('common.close')}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <p id={descId} className="text-sm text-slate-600 dark:text-slate-300">
        {t('ledger.consolidate.subtitle', { owner: ownerLabel })}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {ledger.sources.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
            {t('ledger.consolidate.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ledger.sources.map((source) => (
              <li
                key={source.userId}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {source.name || source.userId}
                  </span>
                  {!source.hasAccount && (
                    <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      {t('ledger.consolidate.noAccount')}
                    </span>
                  )}
                </div>
                {source.name && (
                  <span className="block break-all font-mono text-[11px] text-slate-500">
                    {source.userId}
                  </span>
                )}
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
                  {COUNT_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">
                        {t(COUNT_LABEL_KEYS[key])}
                      </dt>
                      <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {source.counts[key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}

        {submitError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            {submitError}
          </p>
        )}

        <div
          className={`${MODAL_STICKY_FOOTER} flex items-center justify-end gap-2 bg-white pt-2 pb-6 dark:bg-slate-900`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConsolidate}
            aria-busy={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:scale-95 disabled:opacity-50"
          >
            {isPending && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {t('ledger.consolidate.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
