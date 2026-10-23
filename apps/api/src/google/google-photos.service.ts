import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

export interface PhotosUploadResult {
  mediaItemId: string;
  productUrl?: string;
  albumTitle: string;
  albumId: string;
  albumUrl?: string;
  description?: string;
}

export interface PhotosAlbum {
  id: string;
  url?: string;
}

/** The album an upload goes to; the caller resolves it (see `MediaStorageService`). */
export interface PhotosAlbumTarget extends PhotosAlbum {
  title: string;
}

/** Album to use instead of `failedAlbumId` once Google refused it. */
export type ReplacePhotosAlbum = (failedAlbumId: string) => Promise<PhotosAlbum>;

export interface UploadPhotoOptions {
  buffer: Buffer;
  filename: string;
  album: PhotosAlbumTarget;
  replaceAlbum?: ReplacePhotosAlbum;
  description?: string;
}

export interface ChannelPhotoOptions {
  album: PhotosAlbumTarget;
  replaceAlbum?: ReplacePhotosAlbum;
  note?: string;
  extension?: string;
}

interface GooglePhotosAlbum {
  id: string;
  title: string;
  productUrl?: string;
  isWriteable?: boolean;
}

/** Google refused the album itself (deleted, or not writable by the app), not the media item. */
export class PhotosAlbumUnavailableError extends Error {
  constructor(
    public readonly albumId: string,
    public readonly status: number,
    detail: string,
  ) {
    super(`Google Photos album "${albumId}" is unavailable (${status}): ${detail}`);
    this.name = 'PhotosAlbumUnavailableError';
  }
}

/**
 * Whether a failed `mediaItems:batchCreate` points at the album rather than the item: 404, or a
 * 400/403 whose message names the album. Quota, server errors and rejected files are not, so they
 * never lead to a replacement album.
 */
export function isAlbumRejection(status: number, body: string): boolean {
  if (status === 404) return true;
  return (status === 400 || status === 403) && /album/i.test(body);
}

const ALBUM_PAGE_SIZE = 50;
// Upper bound on album pages scanned (2 500 albums) so a bad pageToken loop cannot spin forever.
const MAX_ALBUM_PAGES = 50;

@Injectable()
export class GooglePhotosService {
  private readonly logger = new Logger(GooglePhotosService.name);
  /** Albums by title, per OAuth client: a new Google account (new client) never reuses ids. */
  private readonly albumCache = new WeakMap<object, Map<string, PhotosAlbum>>();
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

  private albumCacheFor(userId?: number | string): Map<string, PhotosAlbum> {
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
   * Finds an app-created album by exact title, scanning every page. Read-only links only: the
   * app's `photoslibrary.appendonly` scope does not allow `albums.list` (it needs
   * `photoslibrary.readonly.appcreateddata`), so Google answers 403 and uploads never rely on it.
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
   * Creates an album, never looking one up first (see `findAppAlbum`): the caller owns the
   * decision, from the channel's album recorded in `channel_storage_links`.
   */
  public async createAlbum(title: string, userId?: number | string): Promise<PhotosAlbum> {
    const accessToken = await this.getAccessToken(userId);
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
    return { id: newAlbum.id, url: newAlbum.productUrl };
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
      if (isAlbumRejection(res.status, errText)) {
        throw new PhotosAlbumUnavailableError(albumId, res.status, errText);
      }
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
      const addTo = (albumId: string) =>
        this.createMediaItem(uploadToken, albumId, options.description, options.filename, userId);

      let album: PhotosAlbum = options.album;
      let media: { mediaItemId: string; productUrl?: string };
      try {
        media = await addTo(album.id);
      } catch (createErr) {
        // Only an album Google refuses is replaced: any other failure (quota, 5xx, a rejected
        // file) keeps the channel's album, so a failed upload never leaves a duplicate album.
        if (!(createErr instanceof PhotosAlbumUnavailableError) || !options.replaceAlbum) {
          throw createErr;
        }
        this.logger.warn(
          `Google Photos album "${options.album.title}" (${album.id}) refused media, using a replacement: ${createErr.message}`,
        );
        album = await options.replaceAlbum(album.id);
        media = await addTo(album.id);
      }

      this.logger.log(
        `Added photo "${options.filename}" to Google Photos album "${options.album.title}" (${media.mediaItemId}).`,
      );

      return {
        mediaItemId: media.mediaItemId,
        productUrl: media.productUrl,
        albumTitle: options.album.title,
        albumId: album.id,
        albumUrl: album.url,
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
   * Tải ảnh hóa đơn / bill vào album của kênh
   */
  public async uploadBillPhoto(
    buffer: Buffer,
    senderId: string,
    options: ChannelPhotoOptions & { occurredAt?: Date },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const date = options.occurredAt || new Date();
    const ts = this.getFormattedTimestamp(date);
    const ext = (options.extension || 'jpg').replace(/^\./, '');

    return this.uploadPhoto(
      {
        buffer,
        filename: `bill_${ts}_${senderId}.${ext}`,
        album: options.album,
        replaceAlbum: options.replaceAlbum,
        description: options.note || `Hóa đơn chi tiêu từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Tải ảnh thông thường vào album của kênh
   */
  public async uploadGeneralPhoto(
    buffer: Buffer,
    senderId: string,
    options: ChannelPhotoOptions,
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const ts = this.getFormattedTimestamp(new Date());
    const ext = (options.extension || 'jpg').replace(/^\./, '');

    return this.uploadPhoto(
      {
        buffer,
        filename: `img_${ts}_${senderId}.${ext}`,
        album: options.album,
        replaceAlbum: options.replaceAlbum,
        description: options.note || `Ảnh từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Tải video vào album của kênh
   */
  public async uploadVideo(
    buffer: Buffer,
    senderId: string,
    options: ChannelPhotoOptions,
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const ts = this.getFormattedTimestamp(new Date());
    const ext = (options.extension || 'mp4').replace(/^\./, '');

    return this.uploadPhoto(
      {
        buffer,
        filename: `vid_${ts}_${senderId}.${ext}`,
        album: options.album,
        replaceAlbum: options.replaceAlbum,
        description: options.note || `Video từ Zalo ID ${senderId}`,
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
  ): Promise<PhotosAlbum | null> {
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
