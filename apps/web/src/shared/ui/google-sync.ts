import type { IGoogleCopySync } from '@zalobot/contracts';

/** Badge tone for the state of a record's Google copy (calendar events, tasks). */
export type SyncTone = 'ok' | 'muted' | 'warn' | 'error';

export type GoogleSyncState = 'synced' | 'pending' | 'failed' | 'local' | 'otherAccount';

export const SYNC_TONE_CLASS: Record<SyncTone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  muted:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  error:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
};

/** A copy in a Google account the system lost reads as "other account" unless it never got there. */
export function googleSyncState(sync: IGoogleCopySync): { state: GoogleSyncState; tone: SyncTone } {
  if (sync.status === 'local') return { state: 'local', tone: 'muted' };
  if (sync.status === 'failed') return { state: 'failed', tone: 'error' };
  if (!sync.isCurrentAccount) return { state: 'otherAccount', tone: 'warn' };
  if (sync.status === 'pending') return { state: 'pending', tone: 'muted' };
  return { state: 'synced', tone: 'ok' };
}
