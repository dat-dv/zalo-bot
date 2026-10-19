'use client';

import { useEffect, useId, useState } from 'react';
import {
  USER_MERGE_TABLES,
  type IUserListItem,
  type IUserMergeResult,
  type TranslationKey,
  type UserMergeGoogleTokenDecision,
  type UserMergeTable,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMergeUserMutation, useUserMergePreviewQuery } from '../../api/users-query';

interface MergeUserDialogProps {
  source: IUserListItem;
  users: IUserListItem[];
  onClose: () => void;
  onMerged: (result: IUserMergeResult, sourceName: string, targetName: string) => void;
}

const TABLE_LABEL_KEYS: Record<UserMergeTable, TranslationKey> = {
  financeTransactions: 'users.merge.table.financeTransactions',
  financePlaces: 'users.merge.table.financePlaces',
  userCategories: 'users.merge.table.userCategories',
  debts: 'users.merge.table.debts',
  debtContacts: 'users.merge.table.debtContacts',
  debtPayments: 'users.merge.table.debtPayments',
  debtPaymentAllocations: 'users.merge.table.debtPaymentAllocations',
  reminders: 'users.merge.table.reminders',
  googleToken: 'users.merge.table.googleToken',
};

const GOOGLE_TOKEN_KEYS: Record<UserMergeGoogleTokenDecision, TranslationKey> = {
  'keep-source': 'users.merge.googleToken.keepSource',
  'keep-target': 'users.merge.googleToken.keepTarget',
  none: 'users.merge.googleToken.none',
};

export function userLabel(user: IUserListItem): string {
  return user.alias || user.firstName || user.displayName || user.zaloName || user.id;
}

export function MergeUserDialog({ source, users, onClose, onMerged }: MergeUserDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const descId = useId();
  const targetSelectId = useId();
  const confirmId = useId();

  const [targetUserId, setTargetUserId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const targets = users.filter((u) => u.id !== source.id);
  const target = targets.find((u) => u.id === targetUserId);
  const preview = useUserMergePreviewQuery(source.id, targetUserId);
  const mergeMutation = useMergeUserMutation();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mergeMutation.isPending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mergeMutation.isPending, onClose]);

  const summary = preview.data;
  const totalRows = summary
    ? USER_MERGE_TABLES.reduce((sum, table) => sum + summary.counts[table], 0)
    : 0;
  const canMerge =
    Boolean(summary && target) &&
    acknowledged &&
    !summary?.sourceIsBotAccount &&
    !mergeMutation.isPending;

  const handleMerge = async () => {
    if (!target || !canMerge) return;
    setSubmitError('');
    try {
      const result = await mergeMutation.mutateAsync({
        sourceUserId: source.id,
        targetUserId: target.id,
      });
      onMerged(result, userLabel(source), userLabel(target));
    } catch {
      setSubmitError(t('users.merge.error'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between pb-3">
          <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('users.merge.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={mergeMutation.isPending}
            aria-label={t('users.merge.close')}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <p id={descId} className="text-sm text-slate-600 dark:text-slate-300">
          {t('users.merge.description', { source: userLabel(source) })}
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('users.merge.sourceLabel')}
            </span>
            <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {userLabel(source)}{' '}
              <span className="font-mono text-xs text-slate-500">{source.id}</span>
            </div>
          </div>

          <div>
            <label
              htmlFor={targetSelectId}
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              {t('users.merge.targetLabel')}
            </label>
            {targets.length === 0 ? (
              <p className="mt-1.5 text-sm text-slate-500">{t('users.merge.noTargets')}</p>
            ) : (
              <select
                id={targetSelectId}
                value={targetUserId}
                onChange={(e) => {
                  setTargetUserId(e.target.value);
                  setAcknowledged(false);
                  setSubmitError('');
                }}
                disabled={mergeMutation.isPending}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">{t('users.merge.targetPlaceholder')}</option>
                {targets.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)} · {u.id}
                  </option>
                ))}
              </select>
            )}
          </div>

          <section aria-live="polite">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('users.merge.previewTitle')}
            </h4>
            {!targetUserId && (
              <p className="mt-1.5 text-sm text-slate-500">{t('users.merge.previewHint')}</p>
            )}
            {targetUserId && preview.isLoading && (
              <div className="mt-2 flex flex-col gap-2" aria-busy="true">
                <span className="sr-only">{t('users.merge.previewLoading')}</span>
                {USER_MERGE_TABLES.slice(0, 4).map((table) => (
                  <div
                    key={table}
                    className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            )}
            {targetUserId && preview.isError && (
              <p
                role="alert"
                className="mt-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
              >
                {t('users.merge.previewError')}
              </p>
            )}
            {summary && (
              <div className="mt-2 flex flex-col gap-3">
                {totalRows === 0 ? (
                  <p className="text-sm text-slate-500">{t('users.merge.previewEmpty')}</p>
                ) : (
                  <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
                    {USER_MERGE_TABLES.filter((table) => summary.counts[table] > 0).map((table) => (
                      <div key={table} className="flex items-center justify-between px-3 py-1.5">
                        <dt className="text-slate-600 dark:text-slate-300">
                          {t(TABLE_LABEL_KEYS[table])}
                        </dt>
                        <dd className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {summary.counts[table]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {summary.conflicts.places +
                  summary.conflicts.contacts +
                  summary.conflicts.categories >
                  0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t('users.merge.conflicts', {
                      places: summary.conflicts.places,
                      contacts: summary.conflicts.contacts,
                      categories: summary.conflicts.categories,
                    })}
                  </p>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {t(GOOGLE_TOKEN_KEYS[summary.conflicts.googleToken])}
                </p>
                {summary.sourceIsBotAccount && (
                  <p
                    role="alert"
                    className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {t('users.merge.botAccountWarning')}
                  </p>
                )}
                {!summary.sourceIsBotAccount && (
                  <label
                    htmlFor={confirmId}
                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <input
                      id={confirmId}
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      disabled={mergeMutation.isPending}
                      className="mt-0.5 size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    {t('users.merge.irreversible')}
                  </label>
                )}
              </div>
            )}
          </section>

          {submitError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mergeMutation.isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('users.merge.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void handleMerge()}
              disabled={!canMerge}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:scale-95 disabled:opacity-50"
            >
              {mergeMutation.isPending ? t('users.merge.merging') : t('users.merge.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
