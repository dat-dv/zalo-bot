/**
 * Single source for the two mobile layout tiers. Tailwind classes cannot read these
 * constants, so markup spells them as `max-sm:` / `max-[640px]:` (phone) and
 * `max-[960px]:` (compact); keep both in sync with the values here.
 */

/** Phone: list rows instead of tables, bottom sheets, 40px touch targets. */
export const PHONE_MAX_WIDTH = 640;
/** Compact: phone plus tablets and phones in landscape; top bar + bottom tab bar replace the sidebar. */
export const COMPACT_MAX_WIDTH = 960;

export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`;
export const COMPACT_MEDIA_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`;
