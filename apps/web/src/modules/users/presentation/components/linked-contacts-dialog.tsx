'use client';

import { useId } from 'react';
import Link from 'next/link';
import { APP_ROUTES, type IUserListItem } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import { useUserLinkedContactsQuery } from '../../api/users-query';
import { userLabel } from './merge-user-dialog';

interface LinkedContactsDialogProps {
  user: IUserListItem;
  onClose: () => void;
}

/** Chiều ngược của liên kết: tài khoản này đang được gắn trong danh bạ công nợ của ai. */
export function LinkedContactsDialog({ user, onClose }: LinkedContactsDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const descId = useId();
  const query = useUserLinkedContactsQuery(user.id);
  const items = query.data ?? [];

  return (
    <Modal
      open
      onDismiss={onClose}
      dismissOnBackdrop
      labelledBy={titleId}
      describedBy={descId}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="max-w-lg rounded-2xl border border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between bg-white pt-6 pb-3 dark:bg-slate-900`}
      >
        <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('users.linkedContacts.title')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('users.linkedContacts.close')}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <p id={descId} className="text-sm text-slate-600 dark:text-slate-300">
        {t('users.linkedContacts.description', { name: userLabel(user) })}
      </p>

      <section className="mt-4" aria-live="polite">
        {query.isLoading && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <span className="sr-only">{t('users.linkedContacts.loading')}</span>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        )}
        {query.isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            <span>{t('users.linkedContacts.error')}</span>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="shrink-0 font-semibold underline"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        {query.isSuccess && items.length === 0 && (
          <p className="text-sm text-slate-500">{t('users.linkedContacts.empty')}</p>
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {items.map((item) => (
              <li
                key={item.contactId}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {item.displayName}
                    {item.alias && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({item.alias})
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {t('users.linkedContacts.debts', { count: item.debtCount })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className={`${MODAL_STICKY_FOOTER} mt-4 flex justify-end gap-2 bg-white pt-3 pb-6 dark:bg-slate-900`}
      >
        <Link
          href={APP_ROUTES.contacts}
          className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t('users.linkedContacts.openContacts')}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {t('users.linkedContacts.close')}
        </button>
      </div>
    </Modal>
  );
}
