import type { ReactNode } from 'react';

/** Button inside `MobileActionBar`: 40px tall, rows share the width evenly. Add colors per action. */
export const MOBILE_ACTION_BUTTON =
  'inline-flex h-10 min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[3px] border px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-50';

/**
 * Thumb-reachable bar for a screen's primary action, pinned above the bottom tab bar on
 * compact screens (<= 960px) and absent on desktop, where the toolbar button stays.
 * Callers hide that toolbar button with `max-[960px]:hidden` so the action appears once.
 * Only for actions the screen already has; never a place to add new features.
 */
export function MobileActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      {/* In-flow spacer so the last rows can scroll out from under the fixed bar. */}
      <div aria-hidden="true" className="hidden h-14 shrink-0 max-[960px]:block" />
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 hidden gap-2 border-t border-slate-200 bg-white/95 py-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 max-[960px]:flex">
        {children}
      </div>
    </>
  );
}
