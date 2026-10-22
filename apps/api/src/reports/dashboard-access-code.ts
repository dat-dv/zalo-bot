import { createHash, randomBytes } from 'crypto';
import {
  DASHBOARD_ACCESS_CODE_ALPHABET,
  DASHBOARD_ACCESS_CODE_LENGTH,
  isDashboardAccessCode,
  normalizeDashboardAccessCode,
} from '@zalobot/contracts';

/**
 * Random sign-in code. The alphabet has 32 symbols, so `byte % 32` keeps every symbol equally
 * likely (256 is a multiple of 32).
 */
export function generateDashboardAccessCode(
  random: (size: number) => Buffer = randomBytes,
): string {
  const bytes = random(DASHBOARD_ACCESS_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) {
    code += DASHBOARD_ACCESS_CODE_ALPHABET[byte % DASHBOARD_ACCESS_CODE_ALPHABET.length];
  }
  return code;
}

/** `K7P2QX9M` -> `K7P2-QX9M`, easier to read off a phone screen. */
export function formatDashboardAccessCode(code: string): string {
  const half = DASHBOARD_ACCESS_CODE_LENGTH / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** Hash of the normalized code, or `null` when the input cannot be a code at all. */
export function hashDashboardAccessCode(raw: string): string | null {
  const code = normalizeDashboardAccessCode(raw);
  if (!isDashboardAccessCode(code)) return null;
  return createHash('sha256').update(code).digest('hex');
}
