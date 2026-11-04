/** Media larger than this is not downloaded: a download is held in memory in full. */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
/** A download that has not finished by then is abandoned instead of blocking the caller. */
const FETCH_TIMEOUT_MS = 120_000;

function tooLarge(bytes: number): Error {
  const mb = Math.round(bytes / (1024 * 1024));
  return new Error(`Tệp media quá lớn (${mb} MB, tối đa ${MAX_MEDIA_BYTES / (1024 * 1024)} MB).`);
}

/**
 * Helper tải Buffer từ URL (HTTP/HTTPS, data URI, hoặc raw string) cho hình ảnh, video hoặc file
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (!url) {
    throw new Error('Đường dẫn tệp media không tồn tại.');
  }

  if (url.startsWith('data:')) {
    const base64Data = url.split(',')[1] || url;
    return Buffer.from(base64Data, 'base64');
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Tải tệp media thất bại: HTTP ${res.status}`);
    }
    const declaredLength = Number(res.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_BYTES) {
      await res.body?.cancel().catch(() => {});
      throw tooLarge(declaredLength);
    }
    const arrayBuffer = await res.arrayBuffer();
    // Without a content-length header the size is only known once downloaded.
    if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
      throw tooLarge(arrayBuffer.byteLength);
    }
    return Buffer.from(arrayBuffer);
  }

  return Buffer.from(url);
}

export const fetchMediaBuffer = fetchImageBuffer;

/**
 * A download shared by several steps of one message (backup, OCR, photo memory): the first caller
 * fetches, later callers get the same bytes. A failed download is not kept, so the next caller
 * tries again.
 */
export function memoizeMediaFetch(url: string): () => Promise<Buffer> {
  let pending: Promise<Buffer> | null = null;
  return () => {
    if (pending === null) {
      pending = fetchImageBuffer(url).catch((err: unknown) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}
