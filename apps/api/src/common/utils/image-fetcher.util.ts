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
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Tải tệp media thất bại: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  return Buffer.from(url);
}

export const fetchMediaBuffer = fetchImageBuffer;
