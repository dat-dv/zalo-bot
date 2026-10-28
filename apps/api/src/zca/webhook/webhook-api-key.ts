import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

/** A shorter key could be guessed; the env validator rejects anything below this. */
export const WEBHOOK_API_KEY_MIN_LENGTH = 32;

function readProvidedKey(headers: IncomingHttpHeaders): string {
  const apiKeyHeader = headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }
  const match = headers.authorization?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

/**
 * Whether the request carries the configured webhook key (`x-api-key` or `Authorization: Bearer`).
 * Both sides are hashed first so the constant-time compare also hides the key length.
 */
export function isWebhookKeyValid(configuredKey: string, headers: IncomingHttpHeaders): boolean {
  const providedKey = readProvidedKey(headers);
  if (!configuredKey || !providedKey) {
    return false;
  }
  const expected = createHash('sha256').update(configuredKey).digest();
  const provided = createHash('sha256').update(providedKey).digest();
  return timingSafeEqual(expected, provided);
}
