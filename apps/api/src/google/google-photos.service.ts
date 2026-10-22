import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

export interface PhotosUploadResult {
  mediaItemId: string;
  productUrl?: string;
  albumTitle: string;
  albumId?: string;
  albumUrl?: string;
  description?: string;
}

export interface UploadPhotoOptions {
  buffer: Buffer;
  filename: string;
  albumTitle: string;
  albumId?: string;
  description?: string;
}

interface GooglePhotosAlbum {
  id: string;
  title: string;
  productUrl?: string;
  isWriteable?: boolean;
}

interface CachedAlbum {
  id: string;
  url?: string;
}

const ALBUM_PAGE_SIZE = 50;
// Upper bound on album pages scanned (2 500 albums) so a bad pageToken loop cannot spin forever.
const MAX_ALBUM_PAGES = 50;

@Injectable()
export class GooglePhotosService {
  private readonly logger = new Logger(GooglePhotosService.name);
  /** Albums by title, per OAuth client: a new Google account (new client) never reuses ids. */
  private readonly albumCache = new WeakMap<object, Map<string, CachedAlbum>>();
  private readonly baseUrl = 'https://photoslibrary.googleapis.com/v1';

  constructor(private readonly authService: GoogleAuthService) {}

  public isAuthorized(userId?: number | string): boolean {
    return this.authService.isAuthorized(userId);
  }

  private async getAccessToken(userId?: number | string): Promise<string> {
    const auth = this.authService.getOAuth2Client(userId);
    if (!auth || !this.authService.isAuthorized(userId)) {
      throw new BadRequestException(
        'Tài khoản Google của hệ thống chưa được kết nối. Quản trị viên vui lòng gõ /login trên Zalo để kích hoạt.',
      );
    }
    const tokenResponse = await auth.getAccessToken();
    const token = tokenResponse.token;
    if (!token) {
      throw new BadRequestException('Không thể lấy Google OAuth access token.');
    }
    return token;
  }

  /**
   * Bước 1: Upload file nhị phân raw bytes lên Google Photos để nhận uploadToken
   */
  public async uploadBytes(
    buffer: Buffer,
    filename: string,
    userId?: number | string,
  ): Promise<string> {
    const accessToken = await this.getAccessToken(userId);

    const res = await fetch(`${this.baseUrl}/uploads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-File-Name': filename,
        'X-Goog-Upload-Protocol': 'raw',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Photos byte upload failed (${res.status}): ${errText}`);
    }

    const uploadToken = await res.text();
    return uploadToken.trim();
  }

  private albumCacheFor(userId?: number | string): Map<string, CachedAlbum> {
    const client = this.authService.getOAuth2Client(userId);
    if (!client) return new Map();
    let cache = this.albumCache.get(client);
    if (!cache) {
      cache = new Map();
      this.albumCache.set(client, cache);
    }
    return cache;
  }

  /**
   * Finds an app-created album by exact title, scanning every page: reading only the first page
   * made albums beyond it invisible, so a duplicate album with the same title was created.
   */
  private async findAppAlbum(
    title: string,
    accessToken: string,
  ): Promise<GooglePhotosAlbum | undefined> {
    const wanted = title.trim();
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_ALBUM_PAGES; page++) {
      const params = new URLSearchParams({
        pageSize: String(ALBUM_PAGE_SIZE),
        excludeNonAppCreatedData: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const listRes = await fetch(`${this.baseUrl}/albums?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!listRes.ok) {
        throw new Error(`Google Photos albums.list failed (${listRes.status})`);
      }
      const listData = (await listRes.json()) as {
        albums?: GooglePhotosAlbum[];
        nextPageToken?: string;
      };
      const found = listData.albums?.find((a) => a.title?.trim() === wanted);
      if (found?.id) return found;
      if (!listData.nextPageToken) return undefined;
      pageToken = listData.nextPageToken;
    }
    return undefined;
  }

  /**
   * Lấy hoặc tạo mới Album theo tiêu đề
   */
  public async getOrCreateAlbum(title: string, userId?: number | string): Promise<string> {
    return (await this.getOrCreateAlbumInfo(title, userId)).id;
  }

  public async getOrCreateAlbumInfo(title: string, userId?: number | string): Promise<CachedAlbum> {
    const cache = this.albumCacheFor(userId);
    const cached = cache.get(title);
    if (cached) return cached;

    const accessToken = await this.getAccessToken(userId);

    // 1. Kiểm tra danh sách albums do app tạo
    try {
      const found = await this.findAppAlbum(title, accessToken);
      if (found) {
        const info = { id: found.id, url: found.productUrl };
        cache.set(title, info);
        return info;
      }
    } catch (listErr) {
      this.logger.warn(`Could not list albums from Google Photos: ${(listErr as Error).message}`);
    }

    // 2. Tạo album mới nếu chưa có
    const createRes = await fetch(`${this.baseUrl}/albums`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        album: {
          title,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(
        `Failed to create Google Photos album "${title}" (${createRes.status}): ${errText}`,
      );
    }

    const newAlbum = (await createRes.json()) as GooglePhotosAlbum;
    if (!newAlbum.id) {
      throw new Error(`Google Photos did not return album id for "${title}"`);
    }

    this.logger.log(`Created Google Photos album "${title}" (id: ${newAlbum.id}).`);
    const info = { id: newAlbum.id, url: newAlbum.productUrl };
    cache.set(title, info);
    return info;
  }

  /**
   * Bước 2: Tạo media item trong album từ uploadToken
   */
  public async createMediaItem(
    uploadToken: string,
    albumId: string,
    description?: string,
    filename?: string,
    userId?: number | string,
  ): Promise<{ mediaItemId: string; productUrl?: string }> {
    const accessToken = await this.getAccessToken(userId);

    const body = {
      albumId,
      newMediaItems: [
        {
          description: description || '',
          simpleMediaItem: {
            fileName: filename || 'media.jpg',
            uploadToken,
          },
        },
      ],
    };

    const res = await fetch(`${this.baseUrl}/mediaItems:batchCreate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Photos batchCreate failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      newMediaItemResults?: Array<{
        status?: { message?: string };
        mediaItem?: { id: string; productUrl?: string };
      }>;
    };

    const result = data.newMediaItemResults?.[0];
    if (!result?.mediaItem?.id) {
      const msg = result?.status?.message || 'Unknown batchCreate error';
      throw new Error(`Google Photos item creation rejected: ${msg}`);
    }

    return {
      mediaItemId: result.mediaItem.id,
      productUrl: result.mediaItem.productUrl,
    };
  }

  /**
   * Upload hoàn chỉnh 1 ảnh vào album cụ thể
   */
  public async uploadPhoto(
    options: UploadPhotoOptions,
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    try {
      const uploadToken = await this.uploadBytes(options.buffer, options.filename, userId);
      let albumId = options.albumId;
      let albumUrl: string | undefined;
      if (!albumId) {
        const album = await this.getOrCreateAlbumInfo(options.albumTitle, userId);
        albumId = album.id;
        albumUrl = album.url;
      }
      let media;
      try {
        media = await this.createMediaItem(
          uploadToken,
          albumId,
          options.description,
          options.filename,
          userId,
        );
      } catch (createErr) {
        // Nếu albumId lưu trước đó bị xoá hoặc không hợp lệ, thử fallback sang getOrCreateAlbum
        if (options.albumId) {
          this.logger.warn(
            `Failed to add to albumId "${options.albumId}", falling back to getOrCreateAlbum("${options.albumTitle}"): ${(createErr as Error).message}`,
          );
          const album = await this.getOrCreateAlbumInfo(options.albumTitle, userId);
          albumId = album.id;
          albumUrl = album.url;
          media = await this.createMediaItem(
            uploadToken,
            albumId,
            options.description,
            options.filename,
            userId,
          );
        } else {
          throw createErr;
        }
      }

      this.logger.log(
        `Added photo "${options.filename}" to Google Photos album "${options.albumTitle}" (${media.mediaItemId}).`,
      );

      return {
        mediaItemId: media.mediaItemId,
        productUrl: media.productUrl,
        albumTitle: options.albumTitle,
        albumId,
        albumUrl,
        description: options.description,
      };
    } catch (err) {
      this.logger.error(
        `Google Photos upload error for "${options.filename}": ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private getFormattedTimestamp(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  /**
   * Tải ảnh hóa đơn / bill vào album "ZaloBot - Hóa đơn"
   */
  public async uploadBillPhoto(
    buffer: Buffer,
    senderId: string,
    options?: {
      note?: string;
      extension?: string;
      occurredAt?: Date;
      albumTitle?: string;
      albumId?: string;
    },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const date = options?.occurredAt || new Date();
    const ts = this.getFormattedTimestamp(date);
    const ext = (options?.extension || 'jpg').replace(/^\./, '');
    const filename = `bill_${ts}_${senderId}.${ext}`;
    const albumTitle = options?.albumTitle?.trim() || 'ZaloBot - Hóa đơn';

    return this.uploadPhoto(
      {
        buffer,
        filename,
        albumTitle,
        albumId: options?.albumId,
        description: options?.note || `Hóa đơn chi tiêu từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Tải ảnh thông thường vào album chỉ định hoặc mặc định "ZaloBot - Hình ảnh"
   */
  public async uploadGeneralPhoto(
    buffer: Buffer,
    senderId: string,
    options?: { note?: string; extension?: string; albumTitle?: string; albumId?: string },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const ts = this.getFormattedTimestamp(new Date());
    const ext = (options?.extension || 'jpg').replace(/^\./, '');
    const filename = `img_${ts}_${senderId}.${ext}`;
    const albumTitle = options?.albumTitle?.trim() || 'ZaloBot - Hình ảnh';

    return this.uploadPhoto(
      {
        buffer,
        filename,
        albumTitle,
        albumId: options?.albumId,
        description: options?.note || `Ảnh từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Tải video vào album chỉ định hoặc mặc định "ZaloBot - Video"
   */
  public async uploadVideo(
    buffer: Buffer,
    senderId: string,
    options?: { note?: string; extension?: string; albumTitle?: string; albumId?: string },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const ts = this.getFormattedTimestamp(new Date());
    const ext = (options?.extension || 'mp4').replace(/^\./, '');
    const filename = `vid_${ts}_${senderId}.${ext}`;
    const albumTitle = options?.albumTitle?.trim() || 'ZaloBot - Video';

    return this.uploadPhoto(
      {
        buffer,
        filename,
        albumTitle,
        albumId: options?.albumId,
        description: options?.note || `Video từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Lấy productUrl (link web) của album Google Photos theo tiêu đề.
   * Trả về null nếu chưa tồn tại hoặc chưa được uỷ quyền.
   */
  public async getAlbumLink(albumTitle: string, userId?: number | string): Promise<string | null> {
    return (await this.findAlbumInfo(albumTitle, userId))?.url ?? null;
  }

  /** Existing app-created album (id + productUrl) by title; never creates one. */
  public async findAlbumInfo(
    albumTitle: string,
    userId?: number | string,
  ): Promise<CachedAlbum | null> {
    const cache = this.albumCacheFor(userId);
    const cached = cache.get(albumTitle);
    if (cached?.url) return cached;

    try {
      const accessToken = await this.getAccessToken(userId);
      const album = await this.findAppAlbum(albumTitle, accessToken);
      if (!album?.productUrl) return null;
      const info = { id: album.id, url: album.productUrl };
      cache.set(albumTitle, info);
      return info;
    } catch {
      return null;
    }
  }
}
