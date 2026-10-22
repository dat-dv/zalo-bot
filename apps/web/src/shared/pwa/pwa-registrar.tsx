'use client';

import { useEffect } from 'react';
import { shouldRegisterServiceWorker } from './pwa-environment';
import { isBeforeInstallPromptEvent, usePwaStore } from './pwa-store';

const SERVICE_WORKER_URL = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev')}`;

function isStandaloneDisplay(): boolean {
  const iosStandalone = 'standalone' in navigator && navigator.standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

/** Tracks a worker until it is installed; one that installs while a page is controlled waits for the user. */
function watchInstalling(worker: ServiceWorker | null) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      usePwaStore.getState().setWaitingWorker(worker);
    }
  });
}

/**
 * Registers the service worker and listens for install/update events once for the whole app.
 * Renders nothing; `AppUpdateToast` and the Settings install card read `usePwaStore`.
 */
export function PwaRegistrar() {
  useEffect(() => {
    const store = usePwaStore.getState();
    if (isStandaloneDisplay()) store.markInstalled();

    const handleInstallPrompt = (event: Event) => {
      // Keep Chrome's mini-infobar away; installing is offered from Settings instead.
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      usePwaStore.getState().setInstallPrompt(event);
    };
    const handleInstalled = () => usePwaStore.getState().markInstalled();
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const canRegister = shouldRegisterServiceWorker({
      isProduction: process.env.NODE_ENV === 'production',
      isSecureContext: window.isSecureContext,
      hasServiceWorker: 'serviceWorker' in navigator,
    });
    let registration: ServiceWorkerRegistration | undefined;
    let reloading = false;
    const handleControllerChange = () => {
      // Only reload when the user asked for the update, not on the very first install.
      if (reloading || !usePwaStore.getState().waitingWorker) return;
      reloading = true;
      window.location.reload();
    };
    const handleVisibility = () => {
      // Installed apps stay open for days; look for a new deploy whenever they come back.
      if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
    };

    if (canRegister) {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { scope: '/' })
        .then((registered) => {
          registration = registered;
          if (registered.waiting && navigator.serviceWorker.controller) {
            usePwaStore.getState().setWaitingWorker(registered.waiting);
          }
          watchInstalling(registered.installing);
          registered.addEventListener('updatefound', () => watchInstalling(registered.installing));
        })
        .catch((error: unknown) => {
          console.error('Service worker registration failed:', error);
        });
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      if (canRegister) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  return null;
}
