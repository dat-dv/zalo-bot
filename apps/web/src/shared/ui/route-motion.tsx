'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { COMPACT_MEDIA_QUERY } from './breakpoints';
import { EASE_IOS, MOTION_MS, prefersReducedMotion } from './motion';

/** Id of the private layout's content column, the element that eases in on route changes. */
export const ROUTE_CONTENT_ID = 'app-route-content';

/**
 * Compact screens: the new page fades in after a route change, so switching tabs does not
 * flash. Opacity only: a transform on this column would become the containing block of the
 * page's fixed action bars and toasts and make them jump. Skips the first load and desktop.
 */
export function RouteMotion(): null {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const content = document.getElementById(ROUTE_CONTENT_ID);
    if (!content || prefersReducedMotion()) return;
    if (!window.matchMedia(COMPACT_MEDIA_QUERY).matches) return;
    content.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: MOTION_MS.page,
      easing: EASE_IOS,
    });
  }, [pathname]);

  return null;
}
