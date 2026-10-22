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
import { ExternalLinkIcon, GoogleDriveIcon, LogoutIcon } from './zca-icons';

const SECONDARY_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${TAP_CONTROL}`;
const PRIMARY_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-[4px] bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 ${TAP_CONTROL}`;
const DANGER_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900 ${TAP_CONTROL}`;

interface GoogleStorageAccountCardProps {
  /** Root `zalobot` folder of the shared account. */
  driveUrl: string;
}

/** The shared Google account every channel's media is saved to, with sign-in / sign-out. */
export function GoogleStorageAccountCard({ driveUrl }: GoogleStorageAccountCardProps) {
  const { t } = useLocale();
  const { data: account, isLoading, isError, refetch } = useGoogleStorageAccountQuery();
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

  const isOpeningLogin = loginMutation.isPending;
  const loginLabel = !account?.connected
    ? t('zca.googleAccount.login')
    : account.hasStorageScopes
      ? t('zca.googleAccount.switch')
      : t('zca.googleAccount.regrant');

  return (
    <section
      aria-labelledby="google-storage-account-title"
      className="rounded-[3px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <GoogleDriveIcon className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <h2
              id="google-storage-account-title"
              className="text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {t('zca.googleAccount.title')}
            </h2>
            {isLoading ? (
              <div className="mt-2 h-4 w-48 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            ) : isError || !account ? (
              <p className="mt-1.5 text-sm text-rose-700 dark:text-rose-300" role="alert">
                {t('zca.googleAccount.error')}
              </p>
            ) : account.connected ? (
              <>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex size-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <span
                    className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-slate-100"
                    title={account.email ?? undefined}
                  >
                    {account.email ?? t('zca.googleAccount.unknownEmail')}
                  </span>
                  {account.hasStorageScopes ? (
                    <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {t('zca.googleAccount.connected')}
                    </span>
                  ) : (
                    <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {t('zca.googleAccount.missingScopes')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {account.hasStorageScopes
                    ? t('zca.googleAccount.description')
                    : t('zca.googleAccount.missingScopesHint')}
                </p>
              </>
            ) : (
              <>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex size-2.5 shrink-0 rounded-full bg-rose-500" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {t('zca.googleAccount.disconnected')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('zca.googleAccount.disconnectedHint')}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Phones: actions take the full row below the account, each 40px tall. */}
        <div className="flex flex-wrap items-center gap-2 max-[640px]:w-full max-[640px]:[&>*]:flex-1">
          {isError ? (
            <button className={SECONDARY_BUTTON} onClick={() => void refetch()} type="button">
              {t('zca.googleAccount.retry')}
            </button>
          ) : account ? (
            <>
              {account.connected && account.hasStorageScopes && (
                <a className={SECONDARY_BUTTON} href={driveUrl} rel="noreferrer" target="_blank">
                  {t('zca.googleAccount.openDrive')}
                  <ExternalLinkIcon />
                </a>
              )}
              <button
                className={
                  account.connected && account.hasStorageScopes ? SECONDARY_BUTTON : PRIMARY_BUTTON
                }
                disabled={isOpeningLogin}
                onClick={() => void handleLogin()}
                type="button"
              >
                {isOpeningLogin ? t('zca.googleAccount.openingLogin') : loginLabel}
              </button>
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
            </>
          ) : null}
        </div>
      </div>

      {(actionError || showLoginHint) && (
        <p
          className={`mt-2 text-[11px] ${actionError ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}
          role={actionError ? 'alert' : 'status'}
        >
          {actionError ?? t('zca.googleAccount.loginHint')}
        </p>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('zca.googleAccount.logoutTitle')}
        message={t('zca.googleAccount.logoutConfirm', {
          email: account?.email ?? t('zca.googleAccount.unknownEmail'),
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
