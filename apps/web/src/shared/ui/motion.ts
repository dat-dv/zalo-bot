/**
 * One motion vocabulary for the phone UI: durations, the iOS-like curve and small Web
 * Animations helpers. CSS-only entrances (page, list rows, toasts, bars) use the matching
 * `animate-*` utilities declared in `styles.css`; keep both in sync.
 *
 * Every helper is a no-op under `prefers-reduced-motion: reduce` or without `element.animate`.
 */

/** iOS sheet/navigation curve: quick start, long soft landing. */
export const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';
export const EASE_OUT = 'cubic-bezier(0.2, 0, 0, 1)';

export const MOTION_MS = {
  sheetIn: 380,
  sheetOut: 260,
  fadeIn: 200,
  fadeOut: 160,
  page: 220,
  indicator: 300,
  bounce: 260,
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function play(
  element: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null {
  if (!element || typeof element.animate !== 'function' || prefersReducedMotion()) return null;
  return element.animate(keyframes, options);
}

/** Bottom sheet rising from the bottom edge. */
export function sheetEnter(element: Element | null): Animation | null {
  return play(element, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], {
    duration: MOTION_MS.sheetIn,
    easing: EASE_IOS,
  });
}

/** Bottom sheet leaving downward from wherever it is now (e.g. mid-swipe). */
export function sheetExit(element: Element | null): Animation | null {
  return play(element, [{ transform: 'translateY(100%)' }], {
    duration: MOTION_MS.sheetOut,
    easing: EASE_IOS,
    fill: 'forwards',
  });
}

/** Centered card appearing on larger screens. */
export function cardEnter(element: Element | null): Animation | null {
  return play(
    element,
    [
      { opacity: 0, transform: 'scale(0.98)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
    { duration: MOTION_MS.fadeIn, easing: EASE_OUT },
  );
}

export function cardExit(element: Element | null): Animation | null {
  return play(element, [{ opacity: 0, transform: 'scale(0.98)' }], {
    duration: MOTION_MS.fadeOut,
    easing: EASE_OUT,
    fill: 'forwards',
  });
}

export function fadeIn(element: Element | null, duration: number = MOTION_MS.fadeIn) {
  return play(element, [{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE_OUT });
}

export function fadeOut(element: Element | null, duration: number = MOTION_MS.fadeOut) {
  return play(element, [{ opacity: 0 }], { duration, easing: EASE_OUT, fill: 'forwards' });
}

/** Small pop for a tapped tab icon. */
export function bounce(element: Element | null): Animation | null {
  return play(
    element,
    [{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1)' }],
    { duration: MOTION_MS.bounce, easing: EASE_IOS },
  );
}

/**
 * A short tick on Android when a gesture crosses its threshold. iOS Safari exposes no
 * vibration API to web pages, so this silently does nothing there.
 */
export function haptic(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
  }
}
