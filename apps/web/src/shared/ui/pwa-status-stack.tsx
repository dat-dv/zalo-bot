'use client';

import { useState } from 'react';
import { usePwaStore } from '@/shared/pwa/pwa-store';
import { useOnlineStatus } from '@/shared/pwa/use-online-status';
import { useLocale } from '@/shared/providers/locale-provider';
import { Button } from '@/shared/ui/button';

/**
 * Small notices pinned to the top center: "offline" and "new version, reload". Top rather than
 * bottom because the phone shell already stacks the tab bar and action bars at the bottom.
 */
export function PwaStatusStack() {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const waitingWorker = usePwaStore((state) => state.waitingWorker);
  // The card covers the top of the page; closing it hides it until the next load.
  const [dismissedWorker, setDismissedWorker] = useState<ServiceWorker | null>(null);
  const showUpdate = waitingWorker !== null && waitingWorker !== dismissedWorker;

  if (isOnline && !showUpdate) return null;

  const applyUpdate = () => {
    // The worker activates, `controllerchange` fires and PwaRegistrar reloads the page once.
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

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
          className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <span className="flex-1 font-medium">{t('pwa.update.title')}</span>
          <Button
            onClick={applyUpdate}
            className="min-h-[36px] shrink-0 rounded bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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
