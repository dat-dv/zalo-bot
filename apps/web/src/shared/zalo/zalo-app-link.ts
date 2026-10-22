/** External Zalo targets for the "Open Zalo Bot" action (not app routes). */
export const ZALO_LINKS = {
  /** Opens the native Zalo app on its home screen. */
  APP: 'zalo://',
  /** Zalo Web, used when the app is not installed. */
  WEB: 'https://chat.zalo.me',
} as const;

/** How long the page may stay visible before we assume no app took the deep link. */
export const ZALO_APP_FALLBACK_DELAY_MS = 1500;

export interface ZaloLaunchHost {
  navigate: (url: string) => void;
  /** Returns false when the new tab was blocked. */
  openTab: (url: string) => boolean;
  /** Calls `listener` once the user leaves the page (app opened); returns an unsubscribe. */
  onLeave: (listener: () => void) => () => void;
  setTimer: (callback: () => void, delayMs: number) => () => void;
}

/**
 * Tries the native app first; when the page is still in front after the delay,
 * no app handled the deep link, so Zalo Web is opened instead.
 */
export function launchZalo(
  host: ZaloLaunchHost,
  fallbackDelayMs: number = ZALO_APP_FALLBACK_DELAY_MS,
): void {
  let settled = false;
  let unsubscribe: () => void = () => undefined;
  let clearTimer: () => void = () => undefined;

  const settle = () => {
    settled = true;
    unsubscribe();
    clearTimer();
  };

  unsubscribe = host.onLeave(() => {
    if (!settled) settle();
  });
  clearTimer = host.setTimer(() => {
    if (settled) return;
    settle();
    // The timer runs outside the click gesture, so popup blockers may refuse the tab.
    if (!host.openTab(ZALO_LINKS.WEB)) host.navigate(ZALO_LINKS.WEB);
  }, fallbackDelayMs);

  host.navigate(ZALO_LINKS.APP);
}

function createBrowserLaunchHost(): ZaloLaunchHost {
  return {
    navigate: (url) => {
      window.location.href = url;
    },
    openTab: (url) => {
      // `noopener` makes window.open return null, so open first and detach the opener manually.
      const tab = window.open(url, '_blank');
      if (!tab) return false;
      tab.opener = null;
      return true;
    },
    onLeave: (listener) => {
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') listener();
      };
      window.addEventListener('blur', listener);
      window.addEventListener('pagehide', listener);
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        window.removeEventListener('blur', listener);
        window.removeEventListener('pagehide', listener);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    },
    setTimer: (callback, delayMs) => {
      const id = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(id);
    },
  };
}

export function openZalo(): void {
  if (typeof window === 'undefined') return;
  launchZalo(createBrowserLaunchHost());
}

export interface LinkClickEvent {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}

/**
 * onClick for an `<a href={ZALO_LINKS.WEB}>`: modified/middle clicks keep the native
 * "open Zalo Web in a tab" behavior, a plain click tries the app first.
 */
export function handleZaloLinkClick(event: LinkClickEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  openZalo();
}
