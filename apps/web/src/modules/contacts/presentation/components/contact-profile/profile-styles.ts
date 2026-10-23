import { BUTTON_TONE } from '@/shared/ui/button-styles';

/** Square, compact controls shared by the profile page (same look as the contacts table). */
// Phone width (<= 640px): every control below grows to a 40px touch target; desktop unchanged.
export const PROFILE_INPUT =
  'h-6 min-h-6 max-[640px]:h-10 max-[640px]:min-h-10 w-full rounded-[2px] border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 focus:shadow-[0_0_0_1px_rgba(2,132,199,0.2)] aria-invalid:border-rose-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400';

export const PROFILE_TEXTAREA =
  'min-h-24 w-full rounded-[2px] border border-slate-300 bg-white px-1.5 py-1 text-[11.5px] leading-relaxed text-slate-900 outline-none focus:border-sky-600 focus:shadow-[0_0_0_1px_rgba(2,132,199,0.2)] aria-invalid:border-rose-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400';

const BUTTON =
  'inline-flex h-[22px] min-h-[22px] shrink-0 items-center rounded-[2px] border px-1.5 text-[11px] whitespace-nowrap max-[640px]:h-10 max-[640px]:min-h-10 max-[640px]:min-w-10 max-[640px]:justify-center max-[640px]:px-3 max-[640px]:text-[12.5px]';

export const PRIMARY_BUTTON = `${BUTTON} font-semibold ${BUTTON_TONE.primary}`;

export const SECONDARY_BUTTON = `${BUTTON} font-medium ${BUTTON_TONE.secondary}`;

export const GHOST_BUTTON = `${BUTTON} font-medium ${BUTTON_TONE.accent}`;

export const FIELD_LABEL = 'text-[11px] font-medium text-slate-500 dark:text-slate-400';

export const FIELD_ERROR = 'mt-0.5 text-[11px] text-rose-600 dark:text-rose-400';

export const MUTED = 'text-slate-400 dark:text-slate-500';
