'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';
import { APP_ROUTES, type TranslationKey } from '@zalobot/contracts';
import { useTheme } from '@/shared/store/theme-store';
import { useLocale } from '@/shared/providers/locale-provider';
import { useBodyScrollLock } from '@/shared/hooks/use-body-scroll-lock';

export type NavigationPage =
  | 'home'
  | 'transactions'
  | 'debts'
  | 'analytics'
  | 'calendar'
  | 'tasks'
  | 'reminders'
  | 'contacts'
  | 'places'
  | 'zca'
  | 'settings';

type NavigationIcon =
  | 'overview'
  | 'transactions'
  | 'debts'
  | 'analytics'
  | 'calendar'
  | 'tasks'
  | 'reminders'
  | 'contacts'
  | 'places'
  | 'zca'
  | 'settings';

interface NavItem {
  page: NavigationPage;
  href: string;
  labelKey: TranslationKey;
  icon: NavigationIcon;
}

interface NavSection {
  titleKey: TranslationKey;
  items: NavItem[];
}

const navSections: readonly NavSection[] = [
  {
    titleKey: 'nav.section.overview',
    items: [{ page: 'home', href: APP_ROUTES.home, labelKey: 'nav.home', icon: 'overview' }],
  },
  {
    titleKey: 'nav.section.finance',
    items: [
      {
        page: 'transactions',
        href: APP_ROUTES.transactions,
        labelKey: 'nav.transactions',
        icon: 'transactions',
      },
      { page: 'debts', href: APP_ROUTES.debts, labelKey: 'nav.debts', icon: 'debts' },
      {
        page: 'analytics',
        href: APP_ROUTES.analytics,
        labelKey: 'nav.analytics',
        icon: 'analytics',
      },
    ],
  },
  {
    titleKey: 'nav.section.planning',
    items: [
      {
        page: 'calendar',
        href: APP_ROUTES.calendar,
        labelKey: 'nav.calendar',
        icon: 'calendar',
      },
      { page: 'tasks', href: APP_ROUTES.tasks, labelKey: 'nav.tasks', icon: 'tasks' },
      {
        page: 'reminders',
        href: APP_ROUTES.reminders,
        labelKey: 'nav.reminders',
        icon: 'reminders',
      },
    ],
  },
  {
    titleKey: 'nav.section.data',
    items: [
      {
        page: 'contacts',
        href: APP_ROUTES.contacts,
        labelKey: 'nav.contacts',
        icon: 'contacts',
      },
      {
        page: 'places',
        href: APP_ROUTES.places,
        labelKey: 'nav.places',
        icon: 'places',
      },
    ],
  },
  {
    titleKey: 'nav.section.system',
    items: [
      {
        page: 'zca',
        href: APP_ROUTES.zca,
        labelKey: 'nav.zca',
        icon: 'zca',
      },
      {
        page: 'settings',
        href: APP_ROUTES.settings,
        labelKey: 'nav.settings',
        icon: 'settings',
      },
    ],
  },
];

export function AppNavigation({ active, footer }: { active?: NavigationPage; footer?: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const nextThemeLabel = theme === 'light' ? t('nav.dark') : t('nav.light');

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
  useBodyScrollLock(isOpen);

  const isItemActive = (item: NavItem): boolean => {
    if (active) return active === item.page;
    if (item.href === APP_ROUTES.home) {
      return pathname === '/' || pathname === '' || pathname === APP_ROUTES.dashboard;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>
      <header className="sticky top-0 z-40 hidden min-h-[46px] items-center justify-between rounded border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900 max-[960px]:flex">
        <Link
          className="inline-flex items-center gap-2 text-slate-900 no-underline dark:text-slate-100"
          href={APP_ROUTES.home}
          onClick={() => setIsOpen(false)}
        >
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-[3px] bg-slate-900 text-xs font-extrabold text-white"
            aria-hidden="true"
          >
            T
          </span>
          <strong>zalobot</strong>
        </Link>
        <button
          aria-controls="app-navigation-drawer"
          aria-expanded={isOpen}
          aria-label={isOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          className="inline-flex size-8 items-center justify-center rounded-[3px] border border-slate-300 !bg-transparent !p-0 !text-slate-900 hover:!border-slate-400 hover:!bg-slate-100 dark:border-slate-600 dark:!text-slate-200 dark:hover:!border-slate-500 dark:hover:!bg-slate-800"
          onClick={() => setIsOpen((prev) => !prev)}
          type="button"
        >
          {isOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </header>

      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[3px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        id="app-navigation-drawer"
        className={`flex h-full w-[210px] flex-col justify-between rounded border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900 max-[960px]:fixed max-[960px]:inset-y-0 max-[960px]:left-0 max-[960px]:z-[60] max-[960px]:h-dvh max-[960px]:max-w-[85vw] max-[960px]:w-[280px] max-[960px]:rounded-none max-[960px]:border-y-0 max-[960px]:border-l-0 max-[960px]:border-r-slate-700 max-[960px]:px-3 max-[960px]:py-3.5 max-[960px]:shadow-[4px_0_24px_rgba(0,0,0,0.15)] max-[960px]:transition-transform max-[960px]:duration-[250ms] max-[960px]:ease-out ${isOpen ? 'max-[960px]:translate-x-0' : 'max-[960px]:-translate-x-full'}`}
        aria-label={t('nav.personalSpace')}
      >
        <div className="mb-3.5 block max-[960px]:flex max-[960px]:items-center max-[960px]:justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <span
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-[3px] bg-slate-900 text-xs font-extrabold text-white"
              aria-hidden="true"
            >
              T
            </span>
            <span>
              <strong className="block text-[13px] leading-[1.1] font-bold tracking-[-.01em]">
                zalobot
              </strong>
              <small className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('nav.personalSpace')}
              </small>
            </span>
          </div>
          <button
            aria-label={t('nav.closeMenu')}
            className="!hidden size-[30px] items-center justify-center rounded-[3px] border border-slate-200 !bg-transparent !p-0 !text-slate-500 hover:!bg-slate-100 hover:!text-slate-900 dark:border-slate-700 dark:!text-slate-400 dark:hover:!bg-slate-800 dark:hover:!text-slate-100 max-[960px]:!inline-flex"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="grid gap-2.5" aria-label={t('nav.personalSpace')}>
          {navSections.map((section) => (
            <div key={section.titleKey} className="grid gap-0.5">
              <p className="mx-1.5 mb-1.5 text-[10px] font-bold tracking-[.08em] text-slate-400 uppercase dark:text-slate-500">
                {t(section.titleKey)}
              </p>
              {section.items.map((item) => {
                const activeState = isItemActive(item);
                return (
                  <Link
                    className={
                      activeState
                        ? 'flex min-h-[30px] w-full items-center gap-2 rounded-[3px] bg-slate-900 px-2 text-left text-[12.5px] font-semibold text-white no-underline dark:bg-slate-100 dark:text-slate-900 max-[960px]:min-h-8'
                        : 'flex min-h-[30px] w-full items-center gap-2 rounded-[3px] px-2 text-left text-[12.5px] font-medium text-slate-600 no-underline hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 max-[960px]:min-h-8'
                    }
                    aria-current={activeState ? 'page' : undefined}
                    href={item.href}
                    key={item.page}
                    onClick={() => setIsOpen(false)}
                  >
                    <NavigationItemIcon icon={item.icon} />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto grid gap-1 border-t border-slate-200 pt-2 dark:border-slate-700">
          {footer}
          <button
            aria-label={nextThemeLabel}
            className="flex min-h-7 w-full items-center gap-2 rounded-[3px] !bg-transparent px-1.5 text-left text-xs font-medium text-slate-600 hover:!bg-slate-100 hover:!text-slate-900 dark:!text-slate-300 dark:hover:!bg-slate-800 dark:hover:!text-slate-100"
            onClick={toggleTheme}
            title={nextThemeLabel}
            type="button"
          >
            <ThemeIcon theme={theme} />
            <span>{theme === 'light' ? t('nav.dark') : t('nav.light')}</span>
          </button>
          <div className="flex items-center gap-1.5 px-1.5 py-0.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('common.language')}
            </span>
            <select
              className="h-6 min-h-6 rounded-[3px] border border-slate-300 bg-white px-1 text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              aria-label={t('common.language')}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
              value={locale}
            >
              <option value="vi">{t('web.language.vi')}</option>
              <option value="en">{t('web.language.en')}</option>
            </select>
          </div>
        </div>
      </aside>
    </>
  );
}

function ThemeIcon({ theme }: { theme: 'light' | 'dark' }) {
  const sharedProps = {
    'aria-hidden': true,
    className: 'size-[15px] shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  return theme === 'light' ? (
    <svg {...sharedProps}>
      <path d="M20.4 15.5A8.5 8.5 0 0 1 8.5 3.6 8.5 8.5 0 1 0 20.4 15.5Z" />
    </svg>
  ) : (
    <svg {...sharedProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function NavigationItemIcon({ icon }: { icon: NavigationIcon }) {
  const sharedProps = {
    'aria-hidden': true,
    className: 'size-[15px] shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  if (icon === 'overview') {
    return (
      <svg {...sharedProps}>
        <rect height="6" width="6" x="3" y="3" />
        <rect height="6" width="6" x="15" y="3" />
        <rect height="6" width="6" x="3" y="15" />
        <rect height="6" width="6" x="15" y="15" />
      </svg>
    );
  }
  if (icon === 'transactions') {
    return (
      <svg {...sharedProps}>
        <path d="m7 16 4-4-4-4" />
        <path d="m17 8-4 4 4 4" />
        <path d="M3 12h18" />
      </svg>
    );
  }
  if (icon === 'debts') {
    return (
      <svg {...sharedProps}>
        <rect height="15" rx="1.5" width="16" x="4" y="4.5" />
        <path d="M8 9.5h8" />
        <path d="M8 14.5h5" />
      </svg>
    );
  }
  if (icon === 'analytics') {
    return (
      <svg {...sharedProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 2 4-6" />
      </svg>
    );
  }
  if (icon === 'calendar') {
    return (
      <svg {...sharedProps}>
        <rect height="16" rx="2" width="18" x="3" y="4" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }
  if (icon === 'tasks') {
    return (
      <svg {...sharedProps}>
        <path d="m9 11 3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (icon === 'reminders') {
    return (
      <svg {...sharedProps}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    );
  }
  if (icon === 'places') {
    return (
      <svg {...sharedProps}>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  if (icon === 'zca') {
    return (
      <svg {...sharedProps}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    );
  }
  if (icon === 'settings') {
    return (
      <svg {...sharedProps}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...sharedProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.7-3.1 2.5-4.7 5.5-4.7s4.8 1.6 5.5 4.7" />
      <path d="M16 8h4" />
      <path d="M18 6v4" />
    </svg>
  );
}

function HamburgerIcon() {
  const sharedProps = {
    'aria-hidden': true,
    className: 'size-[15px] shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  };

  return (
    <svg {...sharedProps}>
      <line x1="3" x2="21" y1="6" y2="6" />
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="3" x2="21" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  const sharedProps = {
    'aria-hidden': true,
    className: 'size-[15px] shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  };

  return (
    <svg {...sharedProps}>
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}
