'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Phone-width layouts (list rows, bottom sheets) start at or below this width. */
export const MOBILE_MEDIA_QUERY = '(max-width: 640px)';

/**
 * Subscribes to a CSS media query. The prerendered HTML and the first client
 * render assume `false` (desktop) so hydration matches; the real value applies
 * right after hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
