'use client';

import { useId, useState } from 'react';
import type { ILedgerConsolidateResult, IUserListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { DataPanel } from '@/shared/ui/data-table';
import { apiErrorMessage } from '../../api/api-error-message';
import { useLedgerQuery, useSetLedgerOwnerMutation } from '../../api/users-query';
import { ConsolidateLedgerDialog } from './consolidate-ledger-dialog';
import { userLabel } from './merge-user-dialog';

interface SharedLedgerPanelProps {
  users: IUserListItem[];
  onNotice: (type: 'success' | 'error', message: string) => void;
}

/** Admin: chọn chủ sổ thu chi chung và gộp dữ liệu tài chính cũ vào sổ đó. */
export function SharedLedgerPanel({ users, onNotice }: SharedLedgerPanelProps) {
  const { t } = useLocale();
  const selectId = useId();
  const ledgerQuery = useLedgerQuery();
  const setOwnerMutation = useSetLedgerOwnerMutation();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isConsolidateOpen, setIsConsolidateOpen] = useState(false);

  const ledger = ledgerQuery.data;
  const ownerUserId = ledger?.ownerUserId ?? null;
  const ownerUser = ownerUserId ? users.find((u) => u.id === ownerUserId) : undefined;
  const ownerLabel = ledger?.ownerName || (ownerUser ? userLabel(ownerUser) : ownerUserId);
  const candidates = users.filter((u) => u.id !== ownerUserId);
  const isSaving = setOwnerMutation.isPending;

  const handleSetOwner = async (userId: string | null) => {
    try {
      await setOwnerMutation.mutateAsync(userId);
      setSelectedUserId('');
      onNotice('success', t('ledger.ownerSaved'));
    } catch (error: unknown) {
      onNotice('error', apiErrorMessage(error));
    }
  };

  const handleConsolidated = (result: ILedgerConsolidateResult) => {
    setIsConsolidateOpen(false);
    onNotice('success', t('ledger.consolidate.success', { count: result.mergedUserIds.length }));
  };

  return (
    <DataPanel
      title={t('ledger.title')}
      description={t('ledger.description')}
      toolbar={
        <button
          type="button"
          onClick={() => setIsConsolidateOpen(true)}
          disabled={!ownerUserId || isSaving}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          {t('ledger.consolidate.button')}
        </button>
      }
    >
      <div className="flex flex-col gap-3 p-3">
        {ledgerQuery.isLoading && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <div className="h-5 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-8 w-full max-w-md animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        )}

        {ledgerQuery.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            <span>{apiErrorMessage(ledgerQuery.error)}</span>
            <button
              type="button"
              onClick={() => void ledgerQuery.refetch()}
              className="rounded-md border border-red-200 px-2 py-1 font-semibold hover:bg-red-100 dark:border-red-900/60 dark:hover:bg-red-950"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {ledger && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('ledger.owner')}
              </span>
              {ownerUserId ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {ownerLabel}
                  </span>
                  {ownerLabel !== ownerUserId && (
                    <span className="break-all font-mono text-[11px] text-slate-500">
                      {ownerUserId}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSetOwner(null)}
                    disabled={isSaving}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t('ledger.clearOwner')}
                  </button>
                </>
              ) : (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('ledger.noOwner')}
                </span>
              )}
            </div>

            {candidates.length > 0 && (
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedUserId) void handleSetOwner(selectedUserId);
                }}
              >
                <label htmlFor={selectId} className="sr-only">
                  {t('ledger.setOwner')}
                </label>
                <select
                  id={selectId}
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none sm:max-w-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">—</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userLabel(u)} · {u.id}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedUserId || isSaving}
                  aria-busy={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {isSaving && (
                    <span className="size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {t('ledger.setOwner')}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {isConsolidateOpen && ledger && (
        <ConsolidateLedgerDialog
          ledger={ledger}
          onClose={() => setIsConsolidateOpen(false)}
          onConsolidated={handleConsolidated}
        />
      )}
    </DataPanel>
  );
}
