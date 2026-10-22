import { createHash, randomInt } from 'crypto';
import { isDashboardAccessCode, normalizeDashboardAccessCode } from '@zalobot/contracts';

/** Digits in a one-time code the bot issues. The API itself accepts digit codes of any length. */
export const DASHBOARD_ACCESS_CODE_LENGTH = 8;

/** Random sign-in code of decimal digits, each drawn uniformly by `randomInt`. */
export function generateDashboardAccessCode(
  randomDigit: () => number = () => randomInt(10),
): string {
  let code = '';
  for (let i = 0; i < DASHBOARD_ACCESS_CODE_LENGTH; i += 1) {
    code += randomDigit().toString();
  }
  return code;
}

/** `12345678` -> `1234-5678`, easier to read off a phone screen. */
export function formatDashboardAccessCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** Hash of the normalized code, or `null` when the input cannot be a code at all. */
export function hashDashboardAccessCode(raw: string): string | null {
  const code = normalizeDashboardAccessCode(raw);
  if (!isDashboardAccessCode(code)) return null;
  return createHash('sha256').update(code).digest('hex');
}
