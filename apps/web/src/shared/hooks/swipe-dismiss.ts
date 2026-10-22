/** Pure gesture math for swipe-to-dismiss (sheets, drawer), kept apart from DOM code for tests. */

/** Share of the surface size the finger must travel to dismiss on release. */
export const SWIPE_DISMISS_RATIO = 0.25;
/** A flick faster than this (px/ms) dismisses regardless of distance. */
export const SWIPE_DISMISS_VELOCITY = 0.5;

/**
 * Offset the surface should follow for a finger delta along the dismiss direction
 * (`direction` 1 = down/right, -1 = up/left). Movement against the direction is resisted
 * instead of followed, so the surface never travels the wrong way.
 */
export function swipeOffset(delta: number, direction: 1 | -1): number {
  const along = delta * direction;
  return along > 0 ? along : along / 4;
}

export function shouldDismissSwipe({
  offset,
  size,
  velocity,
}: {
  /** Distance travelled in the dismiss direction, from `swipeOffset`. */
  offset: number;
  /** Surface height (vertical) or width (horizontal). */
  size: number;
  /** Speed in the dismiss direction at release, px/ms. */
  velocity: number;
}): boolean {
  if (offset <= 0) return false;
  return offset >= size * SWIPE_DISMISS_RATIO || velocity >= SWIPE_DISMISS_VELOCITY;
}
