'use client';

import { useEffect } from 'react';
import { shouldRegisterServiceWorker } from './pwa-environment';
import { isBeforeInstallPromptEvent, usePwaStore } from './pwa-store';
import { pwaUpdater } from './pwa-update';

const SERVICE_WORKER_URL = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev')}`;

function isStandaloneDisplay(): boolean {
  const iosStandalone = 'standalone' in navigator && navigator.standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

/** Stores the waiting worker and swaps it out once a newer deploy replaces it. */
function holdWaitingWorker(registration: ServiceWorkerRegistration, worker: ServiceWorker) {
  usePwaStore.getState().setWaitingWorker(worker);
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'redundant' || usePwaStore.getState().waitingWorker !== worker) return;
    const next = registration.waiting;
    if (next) holdWaitingWorker(registration, next);
    else usePwaStore.getState().setWaitingWorker(null);
  });
}

/** Tracks a worker until it is installed; one that installs while a page is controlled waits for the user. */
function watchInstalling(registration: ServiceWorkerRegistration, worker: ServiceWorker | null) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      holdWaitingWorker(registration, worker);
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
    const handleControllerChange = () => {
      // Only reload for an update, not when the very first install claims the page.
      const { updating, waitingWorker } = usePwaStore.getState();
      if (updating || waitingWorker) pwaUpdater.reloadOnce();
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
            holdWaitingWorker(registered, registered.waiting);
          }
          watchInstalling(registered, registered.installing);
          registered.addEventListener('updatefound', () =>
            watchInstalling(registered, registered.installing),
          );
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
