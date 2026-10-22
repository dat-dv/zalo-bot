'use client';

import type { SaveStatus } from './use-thread-config-form';

interface ThreadConfigActionBarProps {
  status: SaveStatus;
  isSaving: boolean;
}

/**
 * Stays at the bottom of the scroll area so Save is always reachable on a long form. Compact
 * screens stick it above the fixed bottom tab bar instead of under it.
 */
export function ThreadConfigActionBar({ status, isSaving }: ThreadConfigActionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex max-[960px]:bottom-[calc(56px+env(safe-area-inset-bottom))] max-[640px]:px-3 max-[640px]:py-2 items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <p aria-live="polite" className="mr-auto text-sm font-semibold" role="status">
        {status === 'saved' && (
          <span className="text-emerald-600 dark:text-emerald-400">
            ✅ Đã lưu cấu hình thành công!
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-600 dark:text-red-400">Lưu thất bại, hãy thử lại.</span>
        )}
      </p>
      <button
        className="shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 max-[640px]:h-10"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
      </button>
    </div>
  );
}
