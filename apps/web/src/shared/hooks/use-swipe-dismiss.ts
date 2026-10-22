'use client';

import { type RefObject, useEffect, useRef } from 'react';
import { EASE_IOS, haptic } from '@/shared/ui/motion';
import { SWIPE_DISMISS_RATIO, shouldDismissSwipe, swipeOffset } from './swipe-dismiss';

// Finger travel before the gesture locks to an axis (smaller moves stay taps).
const LOCK_DISTANCE_PX = 8;
const SETTLE_MS = 300;

interface SwipeDismissOptions {
  /** The element that follows the finger and slides away. */
  surfaceRef: RefObject<HTMLElement | null>;
  axis: 'x' | 'y';
  /** 1 = dismiss downward/rightward, -1 = upward/leftward. */
  direction: 1 | -1;
  enabled: boolean;
  onDismiss: () => void;
  /** Return false to leave a touch to the page, e.g. one that starts on scrollable content. */
  canStart?: (touch: Touch, surface: HTMLElement) => boolean;
}

/**
 * Swipe-to-dismiss with touch events (iOS fires `pointercancel` as soon as the browser pans,
 * so pointer events cannot drive this). The surface follows the finger through an inline
 * `transform`; on release it either slides out and calls `onDismiss`, or springs back.
 */
export function useSwipeDismiss({
  surfaceRef,
  axis,
  direction,
  enabled,
  onDismiss,
  canStart,
}: SwipeDismissOptions) {
  const onDismissRef = useRef(onDismiss);
  const canStartRef = useRef(canStart);
  useEffect(() => {
    onDismissRef.current = onDismiss;
    canStartRef.current = canStart;
  }, [onDismiss, canStart]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!enabled || !surface) return;

    let start: { x: number; y: number } | null = null;
    let engaged = false;
    let offset = 0;
    let last = { position: 0, time: 0 };
    let velocity = 0;
    let settleTimer = 0;
    let pastThreshold = false;

    const along = (touch: Touch) => (axis === 'y' ? touch.clientY : touch.clientX);
    const across = (touch: Touch) => (axis === 'y' ? touch.clientX : touch.clientY);
    const translate = (value: string) =>
      axis === 'y' ? `translate3d(0, ${value}, 0)` : `translate3d(${value}, 0, 0)`;

    const settle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        surface.style.transition = '';
        surface.style.transform = '';
      }, SETTLE_MS);
    };

    const handleStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) return;
      if (canStartRef.current && !canStartRef.current(touch, surface)) return;
      start = { x: touch.clientX, y: touch.clientY };
      engaged = false;
      offset = 0;
      velocity = 0;
      pastThreshold = false;
      last = { position: along(touch), time: event.timeStamp };
    };

    const handleMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const startAlong = axis === 'y' ? start.y : start.x;
      const startAcross = axis === 'y' ? start.x : start.y;
      const delta = along(touch) - startAlong;
      if (!engaged) {
        const crossDelta = Math.abs(across(touch) - startAcross);
        if (crossDelta > LOCK_DISTANCE_PX && crossDelta > Math.abs(delta)) {
          start = null; // the user is scrolling the other way
          return;
        }
        if (Math.abs(delta) < LOCK_DISTANCE_PX) return;
        engaged = true;
        window.clearTimeout(settleTimer);
        surface.style.transition = 'none';
      }
      event.preventDefault();
      offset = swipeOffset(delta, direction);
      const elapsed = event.timeStamp - last.time;
      if (elapsed > 0) velocity = ((along(touch) - last.position) * direction) / elapsed;
      last = { position: along(touch), time: event.timeStamp };
      surface.style.transform = translate(`${offset * direction}px`);
      const size = axis === 'y' ? surface.offsetHeight : surface.offsetWidth;
      const crossed = offset >= size * SWIPE_DISMISS_RATIO;
      if (crossed && !pastThreshold) haptic(); // tick once when release would now dismiss
      pastThreshold = crossed;
    };

    const handleEnd = () => {
      if (!start) return;
      start = null;
      if (!engaged) return;
      engaged = false;
      const size = axis === 'y' ? surface.offsetHeight : surface.offsetWidth;
      surface.style.transition = `transform ${SETTLE_MS}ms ${EASE_IOS}`;
      if (shouldDismissSwipe({ offset, size, velocity })) {
        surface.style.transform = translate(`${100 * direction}%`);
        onDismissRef.current();
      } else {
        surface.style.transform = translate('0px');
      }
      settle();
    };

    surface.addEventListener('touchstart', handleStart, { passive: true });
    surface.addEventListener('touchmove', handleMove, { passive: false });
    surface.addEventListener('touchend', handleEnd);
    surface.addEventListener('touchcancel', handleEnd);
    // A pending settle timer is left to run: it clears the inline styles after a slide-out,
    // which often coincides with `enabled` turning false.
    return () => {
      surface.removeEventListener('touchstart', handleStart);
      surface.removeEventListener('touchmove', handleMove);
      surface.removeEventListener('touchend', handleEnd);
      surface.removeEventListener('touchcancel', handleEnd);
    };
  }, [surfaceRef, axis, direction, enabled]);
}
