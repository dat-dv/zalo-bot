/**
 * Colour tones for buttons and button-styled links: colours and their hover/dark variants only.
 * Cursor, disabled dimming, the keyboard focus outline and transitions come from the base layer
 * in `styles.css`; size, padding, radius and font weight stay with each caller, so a tone
 * composes with any shape: `${SHAPE} ${BUTTON_TONE.primary}`.
 *
 * Hover is `not-disabled:hover:` rather than `enabled:hover:` because `:enabled` never matches
 * an `<a>`, and a disabled button must keep its resting colours.
 */
export const BUTTON_TONE = {
  /** Save, create, + add, confirm. Dark mode uses the sky accent, never a near-white block. */
  primary:
    'border-slate-900 bg-slate-900 text-white not-disabled:hover:bg-slate-800 dark:border-sky-600 dark:bg-sky-600 dark:text-white dark:not-disabled:hover:bg-sky-500',
  /** Cancel, toolbar actions, pagination, row actions. */
  secondary:
    'border-slate-300 bg-white text-slate-700 not-disabled:hover:border-slate-400 not-disabled:hover:bg-slate-50 not-disabled:hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:not-disabled:hover:border-slate-600 dark:not-disabled:hover:bg-slate-700 dark:not-disabled:hover:text-slate-100',
  /** Icon buttons and quiet actions without a resting frame. */
  ghost:
    'border-transparent bg-transparent text-slate-600 not-disabled:hover:bg-slate-100 not-disabled:hover:text-slate-900 dark:text-slate-300 dark:not-disabled:hover:bg-slate-800 dark:not-disabled:hover:text-slate-100',
  /** Link-like actions ("View", "Open", inline toggles). */
  accent:
    'border-transparent bg-transparent text-sky-700 not-disabled:hover:bg-sky-50 dark:text-sky-400 dark:not-disabled:hover:bg-sky-950/40',
  /** Confirming a destructive action. */
  danger:
    'border-rose-600 bg-rose-600 text-white not-disabled:hover:bg-rose-700 dark:border-rose-600 dark:bg-rose-600 dark:text-white dark:not-disabled:hover:bg-rose-500',
  /** Secondary destructive actions (Delete in a sheet, Logout); a bare rose-900 border sinks into slate-900. */
  dangerSoft:
    'border-rose-200 bg-rose-50 text-rose-700 not-disabled:hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:not-disabled:hover:bg-rose-950/70',
  /** Destructive text actions without a resting frame (row-level remove). */
  dangerGhost:
    'border-transparent bg-transparent text-rose-600 not-disabled:hover:bg-rose-50 not-disabled:hover:text-rose-700 dark:text-rose-400 dark:not-disabled:hover:bg-rose-950/40 dark:not-disabled:hover:text-rose-300',
  /** A granted/healthy state that is also an action (e.g. revoke access). */
  positiveSoft:
    'border-emerald-600 bg-emerald-50 text-emerald-700 not-disabled:hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:not-disabled:hover:bg-emerald-900/60',
  /** Standalone filter/toggle chip, off. Pair with `chipSelected` and `aria-pressed`. */
  chip: 'border-slate-300 bg-white text-slate-600 not-disabled:hover:border-slate-400 not-disabled:hover:bg-slate-50 not-disabled:hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:not-disabled:hover:border-slate-600 dark:not-disabled:hover:bg-slate-800 dark:not-disabled:hover:text-slate-100',
  /** Standalone filter/toggle chip, on (blue = selected). */
  chipSelected:
    'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300',
  /** Option inside a segmented track (`bg-slate-100` group), off. Pair with `segmentSelected`. */
  segment:
    'border-transparent bg-transparent text-slate-600 not-disabled:hover:bg-white/80 not-disabled:hover:text-slate-900 dark:text-slate-300 dark:not-disabled:hover:bg-slate-800 dark:not-disabled:hover:text-slate-100',
  /** Option inside a segmented track, on: a raised tile; neutral, quieter than primary actions. */
  segmentSelected:
    'border-slate-200/80 bg-white text-slate-900 shadow-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white',
} as const;

export type ButtonTone = keyof typeof BUTTON_TONE;
