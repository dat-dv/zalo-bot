'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  APP_ROUTES,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TranslationKey,
} from '@zalobot/contracts';
import { useMoneyVisibility } from '@/shared/store/money-visibility-store';
import { useTheme } from '@/shared/store/theme-store';
import { useLocale } from '@/shared/providers/locale-provider';
import { useIsCompact } from '@/shared/hooks/use-media-query';
import { handleZaloLinkClick, ZALO_LINKS } from '@/shared/zalo/zalo-app-link';
import { LogoutConfirmDialog } from './logout-confirm-dialog';
import { MODAL_STICKY_HEADER, Modal } from './modal';
import { bounce } from './motion';
import { useWorkspaceHeader } from './workspace-header';

const TOPBAR_ICON_BUTTON =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-[3px] border border-slate-300 !bg-transparent !p-0 !text-slate-700 hover:!border-slate-400 hover:!bg-slate-100 dark:border-slate-600 dark:!text-slate-200 dark:hover:!border-slate-500 dark:hover:!bg-slate-800';

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

/** Destinations pinned to the bottom tab bar on compact screens; the rest live behind "More". */
const TAB_BAR_PAGES: readonly NavigationPage[] = ['home', 'transactions', 'debts', 'calendar'];

/** Shorter labels where the sidebar label does not fit a fifth of a phone screen. */
const TAB_BAR_LABEL_KEYS: Partial<Record<NavigationPage, TranslationKey>> = {
  debts: 'nav.tab.debts',
};

const tabBarItems: readonly NavItem[] = TAB_BAR_PAGES.flatMap((page) =>
  navSections
    .flatMap((section) => section.items)
    .filter((item) => item.page === page)
    .map((item) => ({ ...item, labelKey: TAB_BAR_LABEL_KEYS[page] ?? item.labelKey })),
);

const TAB_BAR_ITEM =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[3px] !bg-transparent !p-0 text-[10.5px] leading-tight no-underline';
const TAB_BAR_ITEM_ACTIVE = `${TAB_BAR_ITEM} font-semibold !text-slate-900 dark:!text-slate-100`;
const TAB_BAR_ITEM_IDLE = `${TAB_BAR_ITEM} font-medium !text-slate-500 dark:!text-slate-400`;

const MENU_TILE =
  'flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[3px] border px-1 text-center text-[12px] leading-tight no-underline';
const MENU_TILE_ACTIVE = `${MENU_TILE} border-slate-900 bg-slate-900 font-semibold text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900`;
const MENU_TILE_IDLE = `${MENU_TILE} border-slate-200 bg-slate-50 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200`;
const MENU_FOOTER_BUTTON =
  'inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-[3px] border border-slate-200 !bg-transparent px-3 text-xs font-medium !text-slate-700 dark:border-slate-700 dark:!text-slate-200';
const MENU_LOCALE =
  'inline-flex min-w-0 flex-1 items-center justify-center rounded-[2px] border-0 !px-1 !py-0 text-xs';
const MENU_LOCALE_ACTIVE = `${MENU_LOCALE} !bg-slate-900 font-semibold !text-white dark:!bg-slate-100 dark:!text-slate-900`;
const MENU_LOCALE_IDLE = `${MENU_LOCALE} !bg-transparent font-medium !text-slate-700 dark:!text-slate-200`;
const LOCALE_LABEL_KEYS = {
  vi: 'web.language.vi',
  en: 'web.language.en',
} as const satisfies Record<SupportedLocale, TranslationKey>;

export function AppNavigation({ active, footer }: { active?: NavigationPage; footer?: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const isCompact = useIsCompact();
  // The "More" sheet exists only on compact screens; desktop keeps the sidebar.
  const isMenuOpen = isOpen && isCompact;
  const nextThemeLabel = theme === 'light' ? t('nav.dark') : t('nav.light');
  const { isMoneyVisible, toggleMoneyVisibility } = useMoneyVisibility();
  const {
    title,
    isAuthenticated,
    handleRefresh,
    isLogoutConfirmOpen,
    isLoggingOut,
    requestLogout,
    cancelLogout,
    confirmLogout,
  } = useWorkspaceHeader();
  const moneyLabel = isMoneyVisible ? t('common.hideMoney') : t('common.showMoney');

  // Tab tapped but its route not shown yet: highlight it at once so the tap feels instant.
  const [pendingTab, setPendingTab] = useState<NavigationPage | null>(null);

  useEffect(() => {
    setIsOpen(false);
    setPendingTab(null);
  }, [pathname]);

  const isItemActive = (item: NavItem): boolean => {
    if (active) return active === item.page;
    if (item.href === APP_ROUTES.home) {
      return pathname === '/' || pathname === '' || pathname === APP_ROUTES.dashboard;
    }
    return pathname.startsWith(item.href);
  };

  // Index of the highlighted tab; the last slot is "More".
  const moreIndex = tabBarItems.length;
  const routeTabIndex = tabBarItems.findIndex(isItemActive);
  const pendingTabIndex = pendingTab
    ? tabBarItems.findIndex((item) => item.page === pendingTab)
    : -1;
  const highlightedTab = isMenuOpen
    ? moreIndex
    : pendingTabIndex >= 0
      ? pendingTabIndex
      : routeTabIndex >= 0
        ? routeTabIndex
        : moreIndex;

  // Sliding indicator: one bar that moves to the highlighted tab instead of each tab
  // drawing its own, like native tab bars.
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const indicatorPlaced = useRef(false);
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    if (!isCompact || !indicator) return;
    const place = () => {
      const tab = tabRefs.current[highlightedTab];
      if (!tab) return;
      // First placement (and resizes) jump; later tab changes slide.
      indicator.style.transitionDuration = indicatorPlaced.current ? '' : '0ms';
      indicator.style.width = `${Math.max(0, tab.offsetWidth - 24)}px`;
      indicator.style.transform = `translateX(${tab.offsetLeft + 12}px)`;
      indicatorPlaced.current = true;
    };
    place();
    const handleResize = () => {
      indicatorPlaced.current = false;
      place();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [highlightedTab, isCompact]);

  return (
    <>
      {/* Opaque strip under the status bar so content scrolling past the sticky topbar never shows through.
          Its height and the topbar's sticky top equal the private layout's top padding, so the bar never shifts on scroll. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-40 hidden h-[calc(0.625rem+env(safe-area-inset-top))] bg-[#f8fafc] dark:bg-[#090d16] max-[960px]:block"
      />
      {/* Mobile topbar doubles as the page header: WorkspaceHeader is hidden at this width.
          No menu button: the "More" tab opens the menu, like native tab-bar apps. */}
      <header className="sticky top-0 z-40 max-[960px]:top-[calc(0.625rem+env(safe-area-inset-top))] hidden min-h-[52px] items-center gap-2 rounded border border-slate-200 bg-white py-1.5 pr-1.5 pl-3 dark:border-slate-700 dark:bg-slate-900 max-[960px]:flex">
        <h1
          className="m-0 min-w-0 flex-1 truncate text-[15px] font-bold text-slate-900 dark:text-slate-100"
          title={title}
        >
          {title}
        </h1>
        {isAuthenticated ? (
          <>
            <button
              aria-label={moneyLabel}
              aria-pressed={!isMoneyVisible}
              className={TOPBAR_ICON_BUTTON}
              onClick={toggleMoneyVisibility}
              title={moneyLabel}
              type="button"
            >
              <MoneyVisibilityIcon visible={isMoneyVisible} />
            </button>
            <button
              aria-label={t('common.refresh')}
              className={TOPBAR_ICON_BUTTON}
              onClick={handleRefresh}
              title={t('common.refresh')}
              type="button"
            >
              <RefreshIcon />
            </button>
          </>
        ) : (
          <a
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[3px] border border-slate-900 bg-slate-900 px-3 text-xs font-semibold text-white no-underline transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            href={ZALO_LINKS.WEB}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleZaloLinkClick}
          >
            {t('auth.openzaloBot')}
          </a>
        )}
      </header>

      {/* Desktop sidebar. */}
      <aside
        className="flex h-full w-[210px] flex-col justify-between rounded border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900 max-[960px]:hidden"
        aria-label={t('nav.personalSpace')}
      >
        <div className="mb-3.5 flex items-center gap-2 text-slate-900 dark:text-slate-100">
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
                        ? 'flex min-h-[30px] w-full items-center gap-2 rounded-[3px] bg-slate-900 px-2 text-left text-[12.5px] font-semibold text-white no-underline dark:bg-slate-100 dark:text-slate-900'
                        : 'flex min-h-[30px] w-full items-center gap-2 rounded-[3px] px-2 text-left text-[12.5px] font-medium text-slate-600 no-underline hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                    }
                    aria-current={activeState ? 'page' : undefined}
                    href={item.href}
                    key={item.page}
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

      {/* Compact "More" menu: a bottom sheet with every destination as a 3-column grid, so
          nothing scrolls inside a side panel. Shares Modal motion and swipe-down to close. */}
      <Modal
        open={isMenuOpen}
        onDismiss={() => setIsOpen(false)}
        dismissOnBackdrop
        ariaLabel={t('nav.moreTitle')}
        panelClassName="max-w-md rounded-[4px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      >
        <header
          className={`${MODAL_STICKY_HEADER} flex items-center justify-between gap-2 border-b border-slate-200 bg-white pt-3 pr-1.5 pb-1.5 pl-3 dark:border-slate-700 dark:bg-slate-900`}
        >
          <h2 className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('nav.moreTitle')}
          </h2>
          <button
            aria-label={t('nav.closeMenu')}
            className="inline-flex size-10 items-center justify-center rounded-[3px] !bg-transparent !p-0 !text-slate-500 hover:!bg-slate-100 dark:!text-slate-400 dark:hover:!bg-slate-800"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>
        <nav className="grid gap-3 px-3 pt-2 pb-3" aria-label={t('nav.personalSpace')}>
          {navSections.map((section) => (
            <div key={section.titleKey}>
              <p className="m-0 mb-1.5 text-[10px] font-bold tracking-[.08em] text-slate-400 uppercase dark:text-slate-500">
                {t(section.titleKey)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.items.map((item) => {
                  const activeState = isItemActive(item);
                  return (
                    <Link
                      aria-current={activeState ? 'page' : undefined}
                      className={activeState ? MENU_TILE_ACTIVE : MENU_TILE_IDLE}
                      href={item.href}
                      key={item.page}
                      onClick={() => setIsOpen(false)}
                    >
                      <NavigationItemIcon icon={item.icon} size="tile" />
                      <span className="line-clamp-2">{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <footer className="grid gap-2 border-t border-slate-200 px-3 pt-3 pb-3 dark:border-slate-700">
          <div className="flex gap-2">
            <button
              aria-label={nextThemeLabel}
              className={MENU_FOOTER_BUTTON}
              onClick={toggleTheme}
              type="button"
            >
              <ThemeIcon theme={theme} />
              <span className="truncate">{nextThemeLabel}</span>
            </button>
            {/* Buttons, not a <select>: touch screens force selects to 16px (iOS zoom guard),
                which made the language text larger than the theme button beside it. */}
            <div
              role="group"
              aria-label={t('common.language')}
              className="flex h-10 min-w-0 flex-1 gap-0.5 rounded-[3px] border border-slate-200 p-0.5 dark:border-slate-700"
            >
              {SUPPORTED_LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  className={locale === code ? MENU_LOCALE_ACTIVE : MENU_LOCALE_IDLE}
                  onClick={() => setLocale(code)}
                >
                  <span className="truncate">{t(LOCALE_LABEL_KEYS[code])}</span>
                </button>
              ))}
            </div>
          </div>
          {isAuthenticated && (
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[3px] border border-rose-200 !bg-transparent text-xs font-semibold !text-rose-700 dark:border-rose-900 dark:!text-rose-300"
              onClick={requestLogout}
              type="button"
            >
              <LogoutIcon />
              <span>{t('common.logout')}</span>
            </button>
          )}
        </footer>
      </Modal>

      {/* Opens above the "More" sheet; cancelling returns to it. */}
      <LogoutConfirmDialog
        open={isLogoutConfirmOpen}
        isPending={isLoggingOut}
        onCancel={cancelLogout}
        onConfirm={() => void confirmLogout()}
      />

      <nav
        aria-label={t('nav.tabBar')}
        className="fixed inset-x-0 bottom-0 z-40 hidden h-[calc(56px+env(safe-area-inset-bottom))] items-stretch gap-1 border-t border-slate-200 bg-white px-[max(0.25rem,env(safe-area-inset-left))] pt-1 pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-slate-900 max-[960px]:flex"
      >
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="absolute top-0 left-0 h-0.5 rounded-[1px] bg-slate-900 transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-slate-100"
        />
        {tabBarItems.map((item, index) => {
          const activeState = !isMenuOpen && isItemActive(item);
          return (
            <Link
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              aria-current={activeState ? 'page' : undefined}
              className={`relative ${highlightedTab === index ? TAB_BAR_ITEM_ACTIVE : TAB_BAR_ITEM_IDLE}`}
              href={item.href}
              key={item.page}
              onClick={(event) => {
                bounce(event.currentTarget.querySelector('svg'));
                if (!activeState) setPendingTab(item.page);
              }}
            >
              <TabLoadingBar />
              <NavigationItemIcon icon={item.icon} size="tab" />
              <span className="max-w-full truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <button
          ref={(element) => {
            tabRefs.current[moreIndex] = element;
          }}
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          className={highlightedTab === moreIndex ? TAB_BAR_ITEM_ACTIVE : TAB_BAR_ITEM_IDLE}
          data-press="none"
          onClick={(event) => {
            bounce(event.currentTarget.querySelector('svg'));
            setIsOpen((prev) => !prev);
          }}
          type="button"
        >
          <MoreIcon />
          <span className="max-w-full truncate">{t('nav.more')}</span>
        </button>
      </nav>
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

function NavigationItemIcon({
  icon,
  size = 'list',
}: {
  icon: NavigationIcon;
  size?: 'list' | 'tab' | 'tile';
}) {
  const sharedProps = {
    'aria-hidden': true,
    className:
      size === 'tile'
        ? 'size-6 shrink-0'
        : size === 'tab'
          ? 'size-5 shrink-0'
          : 'size-[15px] shrink-0',
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

const TOPBAR_ICON_PROPS = {
  'aria-hidden': true,
  className: 'size-[17px] shrink-0',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
};

function MoneyVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg {...TOPBAR_ICON_PROPS}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg {...TOPBAR_ICON_PROPS}>
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.7 3.7" />
      <path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg {...TOPBAR_ICON_PROPS}>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <polyline points="21 3 21 8 16 8" />
      <polyline points="3 21 3 16 8 16" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...TOPBAR_ICON_PROPS} className="size-[15px] shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
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

function MoreIcon() {
  return (
    <svg aria-hidden="true" className="size-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** Thin bar across the top of a tab while its route is still loading (slow networks). */
function TabLoadingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-2 -top-1 h-0.5 animate-pulse rounded-[1px] bg-sky-500 dark:bg-sky-400"
    />
  );
}
