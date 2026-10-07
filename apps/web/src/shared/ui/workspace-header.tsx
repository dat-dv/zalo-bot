'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { API_ROUTES, APP_ROUTES, type TranslationKey } from '@zalobot/contracts';
import { clearAccessToken, getAccessToken } from '@/modules/auth/client/auth-storage';
import { httpClient } from '@/shared/api/http-client';
import { useLocale } from '@/shared/providers/locale-provider';
import { useMoneyVisibility } from '@/shared/providers/money-visibility-provider';

function getzaloBotUrl(): string {
  const customUrl = process.env.NEXT_PUBLIC_zalo_BOT_URL?.trim();
  if (customUrl) return customUrl;
  const botUsername = process.env.NEXT_PUBLIC_zalo_BOT_USERNAME?.trim();
  if (botUsername) return `https://t.me/${botUsername}`;
  return 'https://t.me';
}

interface RouteHeaderMeta {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
}

const ROUTE_HEADER_MAP: Record<string, RouteHeaderMeta> = {
  [APP_ROUTES.home]: {
    titleKey: 'dashboard.welcome',
    subtitleKey: 'dashboard.overviewSubtitle',
  },
  [APP_ROUTES.transactions]: {
    titleKey: 'transactions.title',
    subtitleKey: 'transactions.subtitle',
  },
  [APP_ROUTES.debts]: {
    titleKey: 'debts.title',
    subtitleKey: 'debts.subtitle',
  },
  [APP_ROUTES.expenses]: {
    titleKey: 'expenses.title',
    subtitleKey: 'expenses.subtitle',
  },
  [APP_ROUTES.analytics]: {
    titleKey: 'analytics.title',
    subtitleKey: 'analytics.subtitle',
  },
  [APP_ROUTES.calendar]: {
    titleKey: 'calendar.title',
    subtitleKey: 'calendar.subtitle',
  },
  [APP_ROUTES.tasks]: {
    titleKey: 'tasks.title',
    subtitleKey: 'tasks.subtitle',
  },
  [APP_ROUTES.reminders]: {
    titleKey: 'reminders.title',
    subtitleKey: 'reminders.subtitle',
  },
  [APP_ROUTES.contacts]: {
    titleKey: 'contacts.title',
    subtitleKey: 'contacts.subtitle',
  },
  [APP_ROUTES.places]: {
    titleKey: 'places.title',
    subtitleKey: 'places.subtitle',
  },
  [APP_ROUTES.settings]: {
    titleKey: 'settings.title',
    subtitleKey: 'settings.subtitle',
  },
  [APP_ROUTES.about]: {
    titleKey: 'public.about.title',
  },
  [APP_ROUTES.privacy]: {
    titleKey: 'public.privacy.title',
  },
  [APP_ROUTES.terms]: {
    titleKey: 'public.terms.title',
  },
};

export interface WorkspaceHeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  showLogout?: boolean;
  showMoneyToggle?: boolean;
  showRefresh?: boolean;
  extraActions?: ReactNode;
}

export function WorkspaceHeader({
  title: propTitle,
  subtitle: propSubtitle,
  onRefresh,
  showLogout = true,
  showMoneyToggle = true,
  showRefresh = true,
  extraActions,
}: WorkspaceHeaderProps) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { t } = useLocale();
  const { isMoneyVisible, toggleMoneyVisibility } = useMoneyVisibility();

  const [hasToken, setHasToken] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(getAccessToken()));
    if (typeof window !== 'undefined') {
      setIsLoggedOut(new URLSearchParams(window.location.search).get('status') === 'logged_out');
    }
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await httpClient.post(API_ROUTES.dashboardLogout);
    } finally {
      clearAccessToken();
      queryClient.clear();
      window.location.assign(`${APP_ROUTES.home}?status=logged_out`);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    void queryClient.invalidateQueries();
  };

  const routeMeta = ROUTE_HEADER_MAP[pathname];
  const resolvedTitle = propTitle || (routeMeta ? t(routeMeta.titleKey) : 'zalobot');
  const resolvedSubtitle =
    propSubtitle || (routeMeta?.subtitleKey ? t(routeMeta.subtitleKey) : undefined);

  const isAuthenticated = hasToken && !isLoggedOut;

  return (
    <header className="flex min-h-12 items-center justify-between gap-4 rounded border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 max-[960px]:flex-wrap max-[960px]:gap-2 max-[960px]:px-2.5">
      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-base font-bold text-slate-900 dark:text-slate-100"
          title={resolvedTitle}
        >
          {resolvedTitle}
        </h1>
        {resolvedSubtitle && (
          <p
            className="truncate text-xs text-slate-500 dark:text-slate-400"
            title={resolvedSubtitle}
          >
            {resolvedSubtitle}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 max-[960px]:flex-wrap">
        {extraActions}

        {isAuthenticated ? (
          <>
            {showMoneyToggle && (
              <button
                className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-[3px] border border-slate-300 !bg-white px-2.5 text-xs font-medium text-slate-700 hover:!border-slate-400 hover:!bg-slate-100 hover:!text-slate-900 dark:border-slate-600 dark:!bg-slate-800 dark:!text-slate-200 dark:hover:!border-slate-500 dark:hover:!bg-slate-700"
                type="button"
                onClick={toggleMoneyVisibility}
                aria-pressed={!isMoneyVisible}
                aria-label={isMoneyVisible ? t('common.hideMoney') : t('common.showMoney')}
                title={isMoneyVisible ? t('common.hideMoney') : t('common.showMoney')}
              >
                <span aria-hidden="true" className="text-xs leading-none">
                  {isMoneyVisible ? '👁️' : '🔒'}
                </span>
                <span>{isMoneyVisible ? t('common.hideMoney') : t('common.showMoney')}</span>
              </button>
            )}

            {showRefresh && (
              <button
                className="inline-flex min-h-[30px] items-center justify-center rounded-[3px] border border-slate-300 !bg-white px-2.5 text-xs font-medium text-slate-900 hover:!border-slate-400 hover:!bg-slate-100 dark:border-slate-600 dark:!bg-slate-800 dark:!text-slate-100 dark:hover:!border-slate-500 dark:hover:!bg-slate-700"
                type="button"
                onClick={handleRefresh}
              >
                {t('common.refresh')}
              </button>
            )}

            {showLogout && (
              <button
                className="inline-flex min-h-[30px] items-center justify-center rounded-[3px] border border-transparent !bg-transparent px-2.5 text-xs font-medium text-slate-600 hover:!border-slate-200 hover:!bg-slate-100 hover:!text-slate-900 dark:!text-slate-300 dark:hover:!border-slate-700 dark:hover:!bg-slate-800 dark:hover:!text-slate-100"
                type="button"
                onClick={() => void handleLogout()}
              >
                {t('common.logout')}
              </button>
            )}
          </>
        ) : (
          <a
            className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-[3px] border border-slate-900 bg-slate-900 px-3 text-xs font-semibold text-white no-underline transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            href={getzaloBotUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{t('auth.openzaloBot')}</span>
          </a>
        )}
      </div>
    </header>
  );
}
