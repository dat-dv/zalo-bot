'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APP_ROUTES } from '@zalobot/contracts';
import { clearAccessToken } from '@/modules/auth/client/auth-storage';
import { AccessCodeForm } from './access-code-form';
import { useLocale } from '@/shared/providers/locale-provider';
import { handleZaloLinkClick, ZALO_LINKS } from '@/shared/zalo/zalo-app-link';

export type SessionStateReason = 'logged_out' | 'expired' | 'error';

interface SessionStateScreenProps {
  reason?: SessionStateReason;
  onRetry?: () => void;
}

interface ZaloWebApp {
  close?: () => void;
  openzaloLink?: (url: string) => void;
}

function getzaloWebApp(): ZaloWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  const tg = (window as unknown as { zalo?: { WebApp?: ZaloWebApp } }).zalo;
  return tg?.WebApp;
}

export function SessionStateScreen({ reason = 'expired', onRetry }: SessionStateScreenProps) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [isInsidezalo, setIsInsidezalo] = useState(false);

  useEffect(() => {
    const webApp = getzaloWebApp();
    if (webApp && typeof webApp.close === 'function') {
      setIsInsidezalo(true);
    }
  }, []);

  const handleClearAndRetry = () => {
    clearAccessToken();
    queryClient.clear();
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.clear();
      } catch {
        // Ignore storage errors
      }
    }
    if (onRetry) {
      onRetry();
    } else {
      window.location.assign(APP_ROUTES.home);
    }
  };

  const handleCloseMiniApp = () => {
    const webApp = getzaloWebApp();
    if (webApp?.close) {
      webApp.close();
    }
  };

  const isLoggedOut = reason === 'logged_out';
  const title = isLoggedOut ? t('auth.loggedOut.title') : t('auth.sessionExpired.title');
  const description = isLoggedOut ? t('auth.loggedOut.desc') : t('auth.sessionExpired.desc');

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section
        className="w-full max-w-md rounded-[3px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        role="alert"
        aria-live="polite"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-4 flex size-14 items-center justify-center rounded-full text-2xl ${
              isLoggedOut
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : 'border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400'
            }`}
            aria-hidden="true"
          >
            {isLoggedOut ? '👋' : '⏳'}
          </div>

          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <a
              href={ZALO_LINKS.WEB}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleZaloLinkClick}
              className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <span>🤖</span>
              <span>{t('auth.openzaloBot')}</span>
            </a>

            {isInsidezalo && (
              <button
                type="button"
                onClick={handleCloseMiniApp}
                className="inline-flex w-full min-h-[38px] items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('auth.closeMiniApp')}
              </button>
            )}

            <button
              type="button"
              onClick={handleClearAndRetry}
              className="inline-flex w-full min-h-[38px] items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t('auth.clearSessionAndRetry')}
            </button>
          </div>

          <div className="mt-6 w-full border-t border-slate-100 pt-5 dark:border-slate-800">
            <AccessCodeForm />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link
              href={APP_ROUTES.about}
              className="text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              {t('auth.backToAbout')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
