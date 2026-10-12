import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

export interface PhotosUploadResult {
  mediaItemId: string;
  productUrl?: string;
  albumTitle: string;
  albumId?: string;
  description?: string;
}

export interface UploadPhotoOptions {
  buffer: Buffer;
  filename: string;
  albumTitle: string;
  description?: string;
}

interface GooglePhotosAlbum {
  id: string;
  title: string;
  productUrl?: string;
  isWriteable?: boolean;
}

@Injectable()
export class GooglePhotosService {
  private readonly logger = new Logger(GooglePhotosService.name);
  private readonly albumCache: Map<string, string> = new Map();
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

  /**
   * Lấy hoặc tạo mới Album theo tiêu đề
   */
  public async getOrCreateAlbum(title: string, userId?: number | string): Promise<string> {
    const cacheKey = `${userId || 'shared'}:${title}`;
    const cached = this.albumCache.get(cacheKey);
    if (cached) return cached;

    const accessToken = await this.getAccessToken(userId);

    // 1. Kiểm tra danh sách albums do app tạo
    try {
      const listRes = await fetch(
        `${this.baseUrl}/albums?pageSize=50&excludeNonAppCreatedData=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (listRes.ok) {
        const listData = (await listRes.json()) as { albums?: GooglePhotosAlbum[] };
        const found = listData.albums?.find((a) => a.title?.trim() === title.trim());
        if (found?.id) {
          this.albumCache.set(cacheKey, found.id);
          return found.id;
        }
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
    this.albumCache.set(cacheKey, newAlbum.id);
    return newAlbum.id;
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
      const albumId = await this.getOrCreateAlbum(options.albumTitle, userId);
      const media = await this.createMediaItem(
        uploadToken,
        albumId,
        options.description,
        options.filename,
        userId,
      );

      this.logger.log(
        `Added photo "${options.filename}" to Google Photos album "${options.albumTitle}" (${media.mediaItemId}).`,
      );

      return {
        mediaItemId: media.mediaItemId,
        productUrl: media.productUrl,
        albumTitle: options.albumTitle,
        albumId,
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
    options?: { note?: string; extension?: string; occurredAt?: Date },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const date = options?.occurredAt || new Date();
    const ts = this.getFormattedTimestamp(date);
    const ext = (options?.extension || 'jpg').replace(/^\./, '');
    const filename = `bill_${ts}_${senderId}.${ext}`;

    return this.uploadPhoto(
      {
        buffer,
        filename,
        albumTitle: 'ZaloBot - Hóa đơn',
        description: options?.note || `Hóa đơn chi tiêu từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Tải ảnh thông thường vào album "ZaloBot - Hình ảnh"
   */
  public async uploadGeneralPhoto(
    buffer: Buffer,
    senderId: string,
    options?: { note?: string; extension?: string },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const ts = this.getFormattedTimestamp(new Date());
    const ext = (options?.extension || 'jpg').replace(/^\./, '');
    const filename = `img_${ts}_${senderId}.${ext}`;

    return this.uploadPhoto(
      {
        buffer,
        filename,
        albumTitle: 'ZaloBot - Hình ảnh',
        description: options?.note || `Ảnh từ Zalo ID ${senderId}`,
      },
      userId,
    );
  }

  /**
   * Tải video vào album "ZaloBot - Video"
   */
  public async uploadVideo(
    buffer: Buffer,
    senderId: string,
    options?: { note?: string; extension?: string },
    userId?: number | string,
  ): Promise<PhotosUploadResult> {
    const ts = this.getFormattedTimestamp(new Date());
    const ext = (options?.extension || 'mp4').replace(/^\./, '');
    const filename = `vid_${ts}_${senderId}.${ext}`;

    return this.uploadPhoto(
      {
        buffer,
        filename,
        albumTitle: 'ZaloBot - Video',
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
    try {
      const accessToken = await this.getAccessToken(userId);
      const listRes = await fetch(
        `${this.baseUrl}/albums?pageSize=50&excludeNonAppCreatedData=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!listRes.ok) return null;
      const listData = (await listRes.json()) as { albums?: GooglePhotosAlbum[] };
      const album = listData.albums?.find((a) => a.title?.trim() === albumTitle.trim());
      return album?.productUrl ?? null;
    } catch {
      return null;
    }
  }
}
