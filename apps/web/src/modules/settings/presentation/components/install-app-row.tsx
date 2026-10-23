'use client';

import { useSyncExternalStore } from 'react';
import type { TranslationKey } from '@zalobot/contracts';
import { isIosUserAgent, isZaloInAppUserAgent } from '@/shared/pwa/pwa-environment';
import { usePwaStore } from '@/shared/pwa/pwa-store';
import { useLocale } from '@/shared/providers/locale-provider';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';

const noSubscribe = () => () => {};

/** Device facts never change while the page is open; empty on the server so HTML matches. */
function useDeviceInfo(): { userAgent: string; maxTouchPoints: number } {
  const userAgent = useSyncExternalStore(
    noSubscribe,
    () => navigator.userAgent,
    () => '',
  );
  const maxTouchPoints = useSyncExternalStore(
    noSubscribe,
    () => navigator.maxTouchPoints,
    () => 0,
  );
  return { userAgent, maxTouchPoints };
}

/**
 * "Mobile app" row of the Preferences tab. Chromium hands over an install prompt; iOS Safari has
 * none, so it gets the Share-sheet steps; the Zalo in-app browser cannot install at all.
 */
export function InstallAppRow() {
  const { t } = useLocale();
  const installed = usePwaStore((state) => state.installed);
  const installPrompt = usePwaStore((state) => state.installPrompt);
  const { userAgent, maxTouchPoints } = useDeviceInfo();

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    // A prompt can be used once; `appinstalled` marks the app installed on acceptance.
    if (outcome === 'dismissed') usePwaStore.getState().setInstallPrompt(null);
  };

  let hintKey: TranslationKey | null = null;
  if (!installed && !installPrompt) {
    if (isZaloInAppUserAgent(userAgent)) hintKey = 'settings.app.zaloHint';
    else if (isIosUserAgent(userAgent, maxTouchPoints)) hintKey = 'settings.app.iosHint';
    else hintKey = 'settings.app.unsupported';
  }

  return (
    <article className="flex items-center justify-between gap-4 border-b border-slate-200 py-3 dark:border-slate-800">
      <div>
        <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          {t('settings.app.title')}
        </strong>
        <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
          {hintKey ? t(hintKey) : t('settings.app.description')}
        </p>
      </div>
      {installed && (
        <span className="inline-flex shrink-0 items-center rounded-[2px] border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {t('settings.app.installed')}
        </span>
      )}
      {!installed && installPrompt && (
        <Button
          onClick={() => void install()}
          className={`inline-flex h-6 min-w-[76px] shrink-0 items-center justify-center rounded-[3px] border px-2 text-[11px] font-semibold max-[640px]:h-10 max-[640px]:px-3 ${BUTTON_TONE.secondary}`}
        >
          {t('settings.app.install')}
        </Button>
      )}
    </article>
  );
}
