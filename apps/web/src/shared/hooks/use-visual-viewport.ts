'use client';

import { useLayoutEffect } from 'react';

const HEIGHT_VAR = '--app-vvh';
const TOP_VAR = '--app-vv-top';

/**
 * Mirrors `window.visualViewport` (the area left visible above the on-screen
 * keyboard) into CSS variables so fixed overlays can size themselves to it.
 * iOS Safari ignores `interactive-widget`, so `100dvh` alone still extends
 * behind the keyboard there. Without visualViewport support the variables stay
 * unset and CSS falls back to `100dvh`.
 *
 * The first values are written synchronously before paint: an overlay that starts animating
 * at `100dvh` and is resized a frame later visibly jumps where the two heights differ
 * (installed iOS app). Callers must declare this before the effect that shows the overlay.
 */
export function useVisualViewportVars(active: boolean): void {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;

    const root = document.documentElement;
    let frame = 0;
    const write = () => {
      root.style.setProperty(HEIGHT_VAR, `${viewport.height}px`);
      root.style.setProperty(TOP_VAR, `${viewport.offsetTop}px`);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(write);
    };

    write();
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
