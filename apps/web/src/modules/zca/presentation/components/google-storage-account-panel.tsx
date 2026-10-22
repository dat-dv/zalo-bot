'use client';

import { useState } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { TAP_CONTROL } from '@/shared/ui/touch';
import {
  useGoogleStorageAccountQuery,
  useLogoutGoogleStorageAccountMutation,
  useStartGoogleStorageLoginMutation,
} from '../../api/zca-query';
import {
  isForbiddenError,
  isStorageReady,
  storageLoginLabelKey,
} from '../../model/google-storage-account';
import { ExternalLinkIcon, GoogleDriveIcon, LogoutIcon } from './zca-icons';

const SECONDARY_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${TAP_CONTROL}`;
const PRIMARY_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-[4px] bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 ${TAP_CONTROL}`;
const DANGER_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900 ${TAP_CONTROL}`;

interface GoogleStorageAccountPanelProps {
  /** Root `zalobot` folder of the shared account. */
  driveUrl: string;
}

/** The shared Google account every channel's media is saved to, with sign-in / sign-out. */
export function GoogleStorageAccountPanel({ driveUrl }: GoogleStorageAccountPanelProps) {
  const { t } = useLocale();
  const { data: account, isLoading, error, refetch } = useGoogleStorageAccountQuery();
  const loginMutation = useStartGoogleStorageLoginMutation();
  const logoutMutation = useLogoutGoogleStorageAccountMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLoginHint, setShowLoginHint] = useState(false);

  const handleLogin = async () => {
    setActionError(null);
    // Open the tab inside the click: a window opened after the request resolves gets blocked.
    const tab = window.open('', '_blank');
    try {
      const { authUrl } = await loginMutation.mutateAsync();
      if (tab) {
        tab.opener = null;
        tab.location.href = authUrl;
        setShowLoginHint(true);
      } else {
        window.location.href = authUrl;
      }
    } catch {
      tab?.close();
      setActionError(t('zca.googleAccount.loginError'));
    }
  };

  const handleLogout = async () => {
    setActionError(null);
    try {
      await logoutMutation.mutateAsync();
      setIsConfirmOpen(false);
      setShowLoginHint(false);
    } catch {
      setIsConfirmOpen(false);
      setActionError(t('zca.googleAccount.logoutError'));
    }
  };

  if (isLoading) {
    return (
      <section className={PANEL} aria-busy="true" aria-label={t('zca.googleAccount.loading')}>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-5 w-64 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-9 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </section>
    );
  }

  if (isForbiddenError(error)) {
    return (
      <section className={PANEL}>
        <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
          {t('googleStorage.forbidden')}
        </p>
      </section>
    );
  }

  if (error || !account) {
    return (
      <section className={PANEL}>
        <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">
          {t('zca.googleAccount.error')}
        </p>
        <button className={`mt-3 ${SECONDARY_BUTTON}`} onClick={() => void refetch()} type="button">
          {t('zca.googleAccount.retry')}
        </button>
      </section>
    );
  }

  const isReady = isStorageReady(account);

  return (
    <section aria-labelledby="google-storage-account-title" className={PANEL}>
      <div className="flex items-start gap-3">
        <GoogleDriveIcon className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2
            id="google-storage-account-title"
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t('zca.googleAccount.title')}
          </h2>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex size-2.5 shrink-0 rounded-full ${account.connected ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            <span
              className="min-w-0 truncate text-base font-bold text-slate-900 dark:text-slate-100"
              title={account.email ?? undefined}
            >
              {account.connected
                ? (account.email ?? t('zca.googleAccount.unknownEmail'))
                : t('zca.googleAccount.disconnected')}
            </span>
            {account.connected &&
              (account.hasStorageScopes ? (
                <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {t('zca.googleAccount.connected')}
                </span>
              ) : (
                <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {t('zca.googleAccount.missingScopes')}
                </span>
              ))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {!account.connected
              ? t('zca.googleAccount.disconnectedHint')
              : account.hasStorageScopes
                ? t('zca.googleAccount.description')
                : t('zca.googleAccount.missingScopesHint')}
          </p>
        </div>
      </div>

      {/* Phones: one full-width, 40px-tall button per row. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 max-[640px]:flex-col max-[640px]:items-stretch">
        <button
          className={isReady ? SECONDARY_BUTTON : PRIMARY_BUTTON}
          disabled={loginMutation.isPending}
          onClick={() => void handleLogin()}
          type="button"
        >
          {loginMutation.isPending
            ? t('zca.googleAccount.openingLogin')
            : t(storageLoginLabelKey(account))}
        </button>
        {isReady && (
          <a className={SECONDARY_BUTTON} href={driveUrl} rel="noreferrer" target="_blank">
            {t('googleStorage.openRoot')}
            <ExternalLinkIcon />
          </a>
        )}
        {account.connected && (
          <button
            className={DANGER_BUTTON}
            disabled={logoutMutation.isPending}
            onClick={() => setIsConfirmOpen(true)}
            type="button"
          >
            <LogoutIcon />
            {t('zca.googleAccount.logout')}
          </button>
        )}
      </div>

      {(actionError || showLoginHint) && (
        <p
          className={`mt-3 text-xs ${actionError ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}
          role={actionError ? 'alert' : 'status'}
        >
          {actionError ?? t('zca.googleAccount.loginHint')}
        </p>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('zca.googleAccount.logoutTitle')}
        message={t('zca.googleAccount.logoutConfirm', {
          email: account.email ?? t('zca.googleAccount.unknownEmail'),
        })}
        confirmLabel={t('zca.googleAccount.logout')}
        pendingLabel={t('zca.googleAccount.loggingOut')}
        isPending={logoutMutation.isPending}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => void handleLogout()}
      />
    </section>
  );
}

const PANEL =
  'rounded-[3px] border border-slate-200 bg-white p-4 shadow-sm max-[640px]:p-3 dark:border-slate-800 dark:bg-slate-900';
