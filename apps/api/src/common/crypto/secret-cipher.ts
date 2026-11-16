import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Stored secrets carry this prefix so a plain legacy value can still be told apart. */
const ENCRYPTED_PREFIX = 'enc:v1:';
const ENCRYPTION_KEY_PATTERN = /^[0-9a-f]{64}$/i;

/** `DATA_ENCRYPTION_KEY` as a 32-byte AES key, or null when it is missing or malformed. */
export function parseEncryptionKey(value: string | undefined): Buffer | null {
  const trimmed = value?.trim() ?? '';
  return ENCRYPTION_KEY_PATTERN.test(trimmed) ? Buffer.from(trimmed, 'hex') : null;
}

/** AES-256-GCM, `enc:v1:<iv>:<tag>:<data>` in base64url. Empty input stays undefined. */
export function encryptSecret(value: string | undefined, key: Buffer): string | undefined {
  if (!value) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

/**
 * Reverses `encryptSecret`; a value without the prefix is returned as is. Throws when the value
 * was encrypted with another key, so callers decide whether that is fatal.
 */
export function decryptSecret(value: string | undefined, key: Buffer): string | undefined {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) return value;
  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
