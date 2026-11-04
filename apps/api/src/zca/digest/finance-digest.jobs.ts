import type { JobsOptions } from 'bullmq';
import type { ThreadFinanceDigestConfig } from '@zalobot/contracts';

export const FINANCE_DIGEST_QUEUE = 'finance-digest';

export type FinanceDigestKind = keyof ThreadFinanceDigestConfig;

export const FINANCE_DIGEST_KINDS: readonly FinanceDigestKind[] = ['weekly', 'monthly'];

/** 8:00 Vietnam time: Monday for the week before, the 1st for the month before. */
export const FINANCE_DIGEST_CRON: Record<FinanceDigestKind, string> = {
  weekly: '0 8 * * 1',
  monthly: '0 8 1 * *',
};

/**
 * Retries about 15m, 30m, 1h, 2h and 4h apart, so an outage in the morning still delivers the same
 * day, and a digest later than that is dropped rather than arriving stale.
 */
export const FINANCE_DIGEST_JOB_OPTIONS: JobsOptions = {
  attempts: 6,
  backoff: { type: 'exponential', delay: 15 * 60_000 },
  removeOnComplete: true,
  removeOnFail: { count: 20 },
};

export function isFinanceDigestKind(value: string): value is FinanceDigestKind {
  return (FINANCE_DIGEST_KINDS as readonly string[]).includes(value);
}
