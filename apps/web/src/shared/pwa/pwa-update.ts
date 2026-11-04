import { usePwaStore } from './pwa-store';

/** How long a waiting worker gets to take over before the page reloads without it. */
export const UPDATE_RELOAD_FALLBACK_MS = 3000;

export interface SkipWaitingTarget {
  postMessage: (message: { type: 'SKIP_WAITING' }) => void;
}

export interface PwaUpdaterDeps {
  getWaitingWorker: () => Promise<SkipWaitingTarget | null>;
  reload: () => void;
  schedule: (callback: () => void, delayMs: number) => void;
  onStart: () => void;
}

export interface PwaUpdater {
  /**
   * `fallback: true` is a user asking for the update, so the page always reloads: pages come from
   * the network first, so a reload brings the new version even if the worker never takes over.
   * `fallback: false` is the silent update on navigation, which must never reload on its own
   * because the user may already be typing on the new page.
   */
  apply: (options: { fallback: boolean }) => Promise<void>;
  /** Shared by the fallback and `controllerchange`, so the page never reloads twice. */
  reloadOnce: () => void;
}

export function createPwaUpdater(deps: PwaUpdaterDeps): PwaUpdater {
  let started = false;
  let reloaded = false;

  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    deps.reload();
  };

  const askToSkipWaiting = async (): Promise<boolean> => {
    try {
      const worker = await deps.getWaitingWorker();
      worker?.postMessage({ type: 'SKIP_WAITING' });
      return worker !== null;
    } catch {
      // A worker that went redundant can reject the message; treat it as no worker at all.
      return false;
    }
  };

  return {
    reloadOnce,
    apply: async ({ fallback }) => {
      if (!fallback) {
        await askToSkipWaiting();
        return;
      }
      if (started) return;
      started = true;
      deps.onStart();
      const asked = await askToSkipWaiting();
      if (asked) deps.schedule(reloadOnce, UPDATE_RELOAD_FALLBACK_MS);
      else reloadOnce();
    },
  };
}

export const pwaUpdater = createPwaUpdater({
  // Read fresh: the worker kept in the store may have been replaced since it was stored.
  getWaitingWorker: async () => (await navigator.serviceWorker.getRegistration())?.waiting ?? null,
  reload: () => window.location.reload(),
  schedule: (callback, delayMs) => {
    window.setTimeout(callback, delayMs);
  },
  onStart: () => usePwaStore.getState().setUpdating(true),
});
