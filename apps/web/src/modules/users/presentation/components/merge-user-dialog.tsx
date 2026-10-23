'use client';

import { useId, useState } from 'react';
import {
  USER_MERGE_TABLES,
  type IUserListItem,
  type IUserMergeResult,
  type TranslationKey,
  type UserMergeGoogleTokenDecision,
  type UserMergeTable,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import {
  Modal,
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
} from '@/shared/ui/modal';
import { useMergeUserMutation, useUserMergePreviewQuery } from '../../api/users-query';

interface MergeUserDialogProps {
  source: IUserListItem;
  users: IUserListItem[];
  onClose: () => void;
  onMerged: (result: IUserMergeResult, sourceName: string, targetName: string) => void;
}

const TABLE_LABEL_KEYS: Record<UserMergeTable, TranslationKey> = {
  financeTransactions: 'users.merge.table.financeTransactions',
  debtContacts: 'users.merge.table.debtContacts',
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
    <Modal
      open
      onDismiss={mergeMutation.isPending ? undefined : onClose}
      labelledBy={titleId}
      describedBy={descId}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="max-w-lg rounded-[3px] border border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between bg-white pt-6 pb-3 dark:bg-slate-900`}
      >
        <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('users.merge.title')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={mergeMutation.isPending}
          aria-label={t('users.merge.close')}
          className={`rounded-[3px] p-1 ${BUTTON_TONE.ghost} ${MODAL_CLOSE_TAP}`}
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
          <div className="mt-1.5 rounded-[3px] border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
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
              className="mt-1.5 w-full rounded-[3px] border border-slate-300 bg-white px-3 py-2 text-sm max-sm:h-10 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
              className="mt-2 rounded-[3px] bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              {t('users.merge.previewError')}
            </p>
          )}
          {summary && (
            <div className="mt-2 flex flex-col gap-3">
              {totalRows === 0 ? (
                <p className="text-sm text-slate-500">{t('users.merge.previewEmpty')}</p>
              ) : (
                <dl className="divide-y divide-slate-100 rounded-[3px] border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
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
              {summary.conflicts.linkedContacts > 0 && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {t('users.merge.conflicts', { contacts: summary.conflicts.linkedContacts })}
                </p>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t(GOOGLE_TOKEN_KEYS[summary.conflicts.googleToken])}
              </p>
              {summary.sourceIsBotAccount && (
                <p
                  role="alert"
                  className="rounded-[3px] bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  {t('users.merge.botAccountWarning')}
                </p>
              )}
              {!summary.sourceIsBotAccount && (
                <label
                  htmlFor={confirmId}
                  className="flex items-start gap-2 text-sm text-slate-700 max-sm:min-h-10 max-sm:py-2 dark:text-slate-200"
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
            className="rounded-[3px] bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
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
            disabled={mergeMutation.isPending}
            className={`rounded-[3px] px-4 py-2 text-sm font-medium ${BUTTON_TONE.ghost} ${MODAL_FOOTER_TAP}`}
          >
            {t('users.merge.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleMerge()}
            disabled={!canMerge}
            className={`rounded-[3px] px-4 py-2 text-sm font-semibold shadow-sm ${BUTTON_TONE.danger} ${MODAL_FOOTER_TAP}`}
          >
            {mergeMutation.isPending ? t('users.merge.merging') : t('users.merge.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
