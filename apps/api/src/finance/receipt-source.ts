import type { GoogleDriveService } from '../google/google-drive.service';

/** Where a stored `receipt_url` can be loaded from by the receipt proxy. */
export type ReceiptSource = { kind: 'drive'; fileId: string } | { kind: 'zalo'; url: string };

/** Zalo media CDNs seen in ZCA message payloads; anything else is refused (no open proxy / SSRF). */
const ZALO_MEDIA_HOST_SUFFIXES = ['.zadn.vn', '.zdn.vn', '.zalo.me', '.zaloapp.com'];

const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,}$/;

export function parseReceiptSource(rawUrl: string | undefined | null): ReceiptSource | null {
  const value = rawUrl?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    // webViewLink: /file/d/<id>/view ; older links: ?id=<id>
    const fromPath = /\/file\/d\/([^/]+)/.exec(url.pathname)?.[1];
    const fileId = fromPath ?? url.searchParams.get('id') ?? '';
    return DRIVE_FILE_ID.test(fileId) ? { kind: 'drive', fileId } : null;
  }
  if (url.protocol === 'https:' && ZALO_MEDIA_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { kind: 'zalo', url: url.toString() };
  }
  return null;
}

export interface DownloadedReceipt {
  content: Buffer;
  mimeType: string;
}

/**
 * Receipts are uploaded with the shared Google account, but `drive.file` only lets a token read
 * files its own account created. Tries the shared token, then the creator's token (receipts of
 * older versions), then the file's public "anyone with the link" sharing — which still works
 * after the shared Google account changed.
 */
export async function downloadDriveReceipt(
  drive: Pick<GoogleDriveService, 'downloadFile' | 'downloadPublicFile'>,
  fileId: string,
  options: { creatorUserId?: string | null; timeoutMs: number },
): Promise<DownloadedReceipt> {
  const attempts: (() => Promise<DownloadedReceipt>)[] = [
    () => drive.downloadFile(fileId),
    ...(options.creatorUserId
      ? [() => drive.downloadFile(fileId, options.creatorUserId ?? undefined)]
      : []),
    () => drive.downloadPublicFile(fileId, options.timeoutMs),
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err: unknown) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Drive receipt unavailable');
}
