'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { COMPACT_MEDIA_QUERY, PHONE_MEDIA_QUERY } from '@/shared/ui/breakpoints';

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

/** True at phone width (<= 640px): list rows, bottom sheets, 40px touch targets. */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_MEDIA_QUERY);
}

/** True at compact width (<= 960px): top bar, bottom tab bar and list rows replace desktop chrome. */
export function useIsCompact(): boolean {
  return useMediaQuery(COMPACT_MEDIA_QUERY);
}
