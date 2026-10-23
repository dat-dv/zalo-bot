'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { usePwaStore } from '@/shared/pwa/pwa-store';
import { useOnlineStatus } from '@/shared/pwa/use-online-status';
import { useLocale } from '@/shared/providers/locale-provider';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';

function applyUpdate(worker: ServiceWorker | null) {
  // The worker activates, `controllerchange` fires and PwaRegistrar reloads the page once.
  worker?.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * A waiting deploy is applied on the next in-app navigation: the page changes anyway, so the
 * reload costs nothing and no half-typed form is lost (forms live inside one route).
 */
function useApplyUpdateOnNavigation(waitingWorker: ServiceWorker | null) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    applyUpdate(waitingWorker);
  }, [pathname, waitingWorker]);
}

/**
 * Small notices pinned to the top center: "offline" and, on desktop, "new version, reload".
 * Compact screens show the update notice as `PwaUpdateBar` in the page flow instead, so it
 * pushes content down rather than covering the period toolbar or tabs.
 */
export function PwaStatusStack() {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const waitingWorker = usePwaStore((state) => state.waitingWorker);
  useApplyUpdateOnNavigation(waitingWorker);
  // The card covers the top of the page; closing it hides it until the next load.
  const [dismissedWorker, setDismissedWorker] = useState<ServiceWorker | null>(null);
  const showUpdate = waitingWorker !== null && waitingWorker !== dismissedWorker;

  if (isOnline && !showUpdate) return null;

  return (
    // Phone: just under the workspace header so its menu button stays reachable.
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4 max-[960px]:top-[calc(4.5rem+env(safe-area-inset-top))]">
      {!isOnline && (
        <p
          role="status"
          className="pointer-events-auto rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {t('pwa.offline.banner')}
        </p>
      )}
      {showUpdate && (
        <div
          role="status"
          className="pointer-events-auto flex max-[960px]:hidden w-full max-w-sm items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <span className="flex-1 font-medium">{t('pwa.update.title')}</span>
          <Button
            onClick={() => applyUpdate(waitingWorker)}
            className="min-h-[36px] shrink-0 rounded bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
          >
            {t('pwa.update.reload')}
          </Button>
          <Button
            onClick={() => setDismissedWorker(waitingWorker)}
            aria-label={t('common.close')}
            className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/** Compact-screen update notice: a slim 40px row under the topbar, in the page flow. */
export function PwaUpdateBar() {
  const { t } = useLocale();
  const waitingWorker = usePwaStore((state) => state.waitingWorker);
  const [dismissedWorker, setDismissedWorker] = useState<ServiceWorker | null>(null);
  if (waitingWorker === null || waitingWorker === dismissedWorker) return null;

  return (
    <div
      role="status"
      className="hidden min-h-10 items-center gap-2 rounded border border-sky-200 bg-sky-50 py-1 pr-1 pl-3 text-xs text-sky-900 max-[960px]:flex max-[960px]:animate-bar-down dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
    >
      <span className="min-w-0 flex-1 truncate font-medium">{t('pwa.update.title')}</span>
      <Button
        onClick={() => applyUpdate(waitingWorker)}
        className={`h-8 min-h-8 shrink-0 rounded-[3px] border px-3 text-xs font-semibold ${BUTTON_TONE.primary}`}
      >
        {t('pwa.update.reload')}
      </Button>
      <Button
        onClick={() => setDismissedWorker(waitingWorker)}
        aria-label={t('common.close')}
        // Sits on the sky notice bar, so it keeps the bar's own colours.
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-transparent text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900"
      >
        <span aria-hidden="true">✕</span>
      </Button>
    </div>
  );
}
