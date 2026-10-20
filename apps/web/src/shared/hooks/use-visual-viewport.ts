'use client';

import { useEffect } from 'react';

const HEIGHT_VAR = '--app-vvh';
const TOP_VAR = '--app-vv-top';

/**
 * Mirrors `window.visualViewport` (the area left visible above the on-screen
 * keyboard) into CSS variables so fixed overlays can size themselves to it.
 * iOS Safari ignores `interactive-widget`, so `100dvh` alone still extends
 * behind the keyboard there. Without visualViewport support the variables stay
 * unset and CSS falls back to `100dvh`.
 */
export function useVisualViewportVars(active: boolean): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;

    const root = document.documentElement;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty(HEIGHT_VAR, `${viewport.height}px`);
        root.style.setProperty(TOP_VAR, `${viewport.offsetTop}px`);
      });
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      root.style.removeProperty(HEIGHT_VAR);
      root.style.removeProperty(TOP_VAR);
    };
  }, [active]);
}
