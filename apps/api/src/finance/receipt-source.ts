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
