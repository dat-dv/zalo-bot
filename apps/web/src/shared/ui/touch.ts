/**
 * Shared mobile sizing classes. Desktop keeps the compact 22–30px controls; these only
 * kick in at phone width (<= 640px) or compact width (<= 960px), see `breakpoints.ts`.
 */

/** Any tappable control at phone width: at least 40×40px. Append to the desktop classes. */
export const TAP_CONTROL = 'max-[640px]:h-10 max-[640px]:min-h-10 max-[640px]:min-w-10';

/** Text inputs and selects at phone width: 40px tall, full width. */
export const TAP_INPUT = 'max-[640px]:h-10 max-[640px]:min-h-10 max-[640px]:w-full';

/**
 * Toolbar tier: filter chips, tabs and segmented buttons stay compact at phone width (32px)
 * so a toolbar does not eat the first screen. Sheets, dialogs and forms keep `TAP_CONTROL`.
 */
export const PHONE_CHIP =
  'max-[640px]:h-8 max-[640px]:min-h-8 max-[640px]:px-2.5 max-[640px]:text-[12px]';

/** Icon-only toolbar buttons at phone width (‹ ›, column filter, clear search): 32×32. */
export const PHONE_ICON_CHIP = 'max-[640px]:size-8 max-[640px]:min-h-8';

/** Toolbar search inputs and selects at phone width: 36px, full width. */
export const PHONE_TOOLBAR_INPUT = 'max-[640px]:h-9 max-[640px]:min-h-9 max-[640px]:w-full';

/** Toolbar that keeps one sideways-scrolling row of chips on phones instead of stacking. */
export const MOBILE_TOOLBAR_ROW =
  'max-[640px]:min-w-0 max-[640px]:max-w-full max-[640px]:flex-nowrap max-[640px]:overflow-x-auto max-[640px]:overscroll-x-contain';

/** Bottom tab bar height (without the safe-area inset). Keep in sync with the classes below. */
export const MOBILE_TAB_BAR_HEIGHT_PX = 56;

/**
 * Floating toast: bottom-right on desktop; on compact screens it spans the width and sits
 * above the bottom tab bar and the home indicator.
 */
export const TOAST_POSITION =
  'fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 max-[960px]:left-4 max-[960px]:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-[960px]:animate-toast-in';
