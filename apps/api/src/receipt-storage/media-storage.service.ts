import { Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleDriveService, DriveUploadResult } from '../google/google-drive.service';
import { GooglePhotosService, PhotosUploadResult } from '../google/google-photos.service';
import { GoogleAuthService } from '../google/google-auth.service';
import {
  buildDriveFolderUrl,
  getChannelUploadFolder,
  type ChannelStorageCategory,
  type ChannelStorageTarget,
} from '../google/channel-storage.util';
import { ChannelStorageLinkService } from '../zca/storage/channel-storage-link.service';
import type { CurrentChannelStorage } from '../zca/storage/channel-storage-links.mapper';

export interface DualUploadResult {
  drive?: DriveUploadResult;
  photos?: PhotosUploadResult;
  driveError?: string;
  photosError?: string;
}

interface MediaUploadOptions {
  note?: string;
  extension?: string;
  msgId?: string;
  filename?: string;
}

type PhotosCategory = Extract<ChannelStorageCategory, 'bill' | 'image' | 'video'>;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';

/**
 * Stores channel media on the shared Google account only (never a member's own token), in the
 * channel's Drive root and its one Photos album, and records both in the channel storage history.
 */
@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly photosService?: GooglePhotosService,
    @Optional() private readonly authService?: GoogleAuthService,
    @Optional() private readonly linkService?: ChannelStorageLinkService,
  ) {}

  /** Hóa đơn → Drive `<root>/bill/YYYY-MM` + album Photos của kênh. */
  public async uploadBill(
    senderId: string,
    buffer: Buffer,
    target: ChannelStorageTarget,
    options?: MediaUploadOptions & { occurredAt?: Date },
  ): Promise<DualUploadResult> {
    return this.uploadDual(target, 'bill', {
      drive: (folderPath) =>
        this.requireDrive().uploadReceipt(buffer, senderId, {
          ...options,
          folderPath,
          suffix: target.fileSuffix,
        }),
      photos: (album) =>
        this.requirePhotos().uploadBillPhoto(buffer, senderId, { ...options, ...album }),
    });
  }

  /** Ảnh → Drive `<root>/image/YYYY-MM` + album Photos của kênh. */
  public async uploadImage(
    senderId: string,
    buffer: Buffer,
    target: ChannelStorageTarget,
    options?: MediaUploadOptions,
  ): Promise<DualUploadResult> {
    return this.uploadDual(target, 'image', {
      drive: (folderPath) =>
        this.requireDrive().uploadImage(buffer, senderId, {
          ...options,
          folderPath,
          suffix: target.fileSuffix,
        }),
      photos: (album) =>
        this.requirePhotos().uploadGeneralPhoto(buffer, senderId, { ...options, ...album }),
    });
  }

  /** Video → Drive `<root>/video/YYYY-MM` + album Photos của kênh. */
  public async uploadVideo(
    senderId: string,
    buffer: Buffer,
    target: ChannelStorageTarget,
    options?: MediaUploadOptions,
  ): Promise<DualUploadResult> {
    return this.uploadDual(target, 'video', {
      drive: (folderPath) =>
        this.requireDrive().uploadVideo(buffer, senderId, {
          ...options,
          folderPath,
          suffix: target.fileSuffix,
        }),
      photos: (album) =>
        this.requirePhotos().uploadVideo(buffer, senderId, { ...options, ...album }),
    });
  }

  /** Tài liệu / âm thanh → chỉ Drive `<root>/file/YYYY-MM`. */
  public async uploadFile(
    senderId: string,
    buffer: Buffer,
    target: ChannelStorageTarget,
    options?: MediaUploadOptions & { mimeType?: string },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    if (!this.driveService) return result;
    const email = await this.getStorageEmail();
    try {
      result.drive = await this.driveService.uploadDocument(buffer, senderId, {
        ...options,
        folderPath: getChannelUploadFolder(target, 'file'),
        suffix: target.fileSuffix,
      });
      await this.recordDriveRoot(target, email);
    } catch (err) {
      result.driveError = errorMessage(err);
      this.logger.warn(`Failed to upload file to Google Drive: ${result.driveError}`);
    }
    return result;
  }

  /**
   * Resolves (creating the Drive root if needed, never an album) where new media of the channel
   * goes with the current shared account, and records it. Empty when Google is not connected.
   */
  public async syncCurrentStorage(target: ChannelStorageTarget): Promise<CurrentChannelStorage> {
    const current: CurrentChannelStorage = {};
    if (!this.authService?.isSharedAuthorized() || !this.hasStorageScopes()) return current;
    const email = await this.getStorageEmail();

    current.drive = (await this.recordDriveRoot(target, email)) ?? undefined;

    if (this.photosService) {
      const album = await this.photosService.findAlbumInfo(target.photosAlbumTitle);
      if (album?.url) {
        current.photos = { resourceId: album.id, url: album.url };
        await this.recordPhotosAlbum(target, email, album.id, album.url);
      }
    }
    return current;
  }

  private async uploadDual(
    target: ChannelStorageTarget,
    category: PhotosCategory,
    upload: {
      drive: (folderPath: string) => Promise<DriveUploadResult>;
      photos: (album: { albumTitle: string; albumId?: string }) => Promise<PhotosUploadResult>;
    },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    const email = await this.getStorageEmail();
    const knownAlbum = await this.findKnownAlbum(target, email);

    // `.then` turns a missing service (sync throw) into a rejection of that side only.
    const [drivePromise, photosPromise] = await Promise.allSettled([
      Promise.resolve().then(() => upload.drive(getChannelUploadFolder(target, category))),
      Promise.resolve().then(() =>
        upload.photos({ albumTitle: target.photosAlbumTitle, albumId: knownAlbum?.resourceId }),
      ),
    ]);

    if (drivePromise.status === 'fulfilled') {
      result.drive = drivePromise.value;
      await this.recordDriveRoot(target, email);
    } else {
      result.driveError = errorMessage(drivePromise.reason);
      this.logger.warn(`Failed to upload ${category} to Google Drive: ${result.driveError}`);
    }

    if (photosPromise.status === 'fulfilled') {
      const photos = photosPromise.value;
      // A known album id skips the album lookup, so its URL comes from the recorded link.
      const albumUrl =
        photos.albumUrl ??
        (knownAlbum && knownAlbum.resourceId === photos.albumId ? knownAlbum.url : undefined);
      result.photos = { ...photos, albumUrl };
      if (photos.albumId && albumUrl) {
        await this.recordPhotosAlbum(target, email, photos.albumId, albumUrl);
      }
    } else {
      result.photosError = errorMessage(photosPromise.reason);
      this.logger.warn(`Failed to upload ${category} to Google Photos: ${result.photosError}`);
    }

    return result;
  }

  /** The channel's album already recorded for this account: skips the album lookup. */
  private async findKnownAlbum(
    target: ChannelStorageTarget,
    email: string | null,
  ): Promise<{ resourceId: string; url: string } | null> {
    if (!email || !this.linkService) return null;
    try {
      return await this.linkService.findAlbum(target.channelId, email, target.photosAlbumTitle);
    } catch {
      return null;
    }
  }

  private requireDrive(): GoogleDriveService {
    if (!this.driveService) throw new Error('GoogleDriveService chưa được khởi tạo.');
    return this.driveService;
  }

  private requirePhotos(): GooglePhotosService {
    if (!this.photosService) throw new Error('GooglePhotosService chưa được khởi tạo.');
    return this.photosService;
  }

  private async getStorageEmail(): Promise<string | null> {
    if (!this.authService) return null;
    try {
      return await this.authService.getAccountEmail();
    } catch {
      return null;
    }
  }

  /** History is best effort: a failed write must never fail the upload itself. */
  private async recordDriveRoot(
    target: ChannelStorageTarget,
    email: string | null,
  ): Promise<{ resourceId: string; url: string } | null> {
    if (!this.driveService) return null;
    try {
      const folderId = await this.driveService.ensureFolderPath(target.driveRoot);
      const url = buildDriveFolderUrl(folderId);
      await this.linkService?.record({
        threadId: target.channelId,
        kind: 'drive',
        googleEmail: email,
        resourceId: folderId,
        url,
        label: target.driveRoot,
      });
      return { resourceId: folderId, url };
    } catch (err) {
      this.logger.warn(
        `Could not record Drive root for channel ${target.channelId}: ${errorMessage(err)}`,
      );
      return null;
    }
  }

  private async recordPhotosAlbum(
    target: ChannelStorageTarget,
    email: string | null,
    albumId: string,
    url: string,
  ): Promise<void> {
    try {
      await this.linkService?.record({
        threadId: target.channelId,
        kind: 'photos',
        googleEmail: email,
        resourceId: albumId,
        url,
        label: target.photosAlbumTitle,
      });
    } catch (err) {
      this.logger.warn(
        `Could not record Photos album for channel ${target.channelId}: ${errorMessage(err)}`,
      );
    }
  }

  /**
   * Định dạng tin nhắn tóm tắt kết quả lưu trữ Google Drive & Photos cho Zalo
   */
  public formatUploadSummary(
    result: DualUploadResult,
    type: 'bill' | 'image' | 'video' | 'file' | 'audio',
  ): string {
    const typeLabel =
      type === 'bill'
        ? 'Hóa đơn'
        : type === 'video'
          ? 'Video'
          : type === 'file'
            ? 'Tệp tin'
            : type === 'audio'
              ? 'Âm thanh'
              : 'Hình ảnh';

    const lines: string[] = [`☁️ ĐÃ LƯU TRỮ ${typeLabel.toUpperCase()} LÊN GOOGLE:`];

    if (result.drive) {
      lines.push(
        `• 📁 Google Drive: [${result.drive.folderPath || 'zalobot'}/${result.drive.name}]\n` +
          `  👉 Xem tại: ${result.drive.webViewLink || 'Đã lưu trên Drive'}`,
      );
    } else if (result.driveError) {
      const isPermError =
        result.driveError.includes('Insufficient Permission') ||
        result.driveError.includes('insufficient');
      const errDetail = isPermError
        ? 'Chưa cấp quyền Google Drive (Quản trị viên vui lòng gõ /login để cấp quyền bổ sung)'
        : result.driveError;
      lines.push(`• 📁 Google Drive: ⚠️ Lỗi lưu trữ (${errDetail})`);
    }

    if (result.photos) {
      lines.push(
        `• 📸 Google Photos: [Album: ${result.photos.albumTitle}]\n` +
          `  👉 Xem tại: ${result.photos.productUrl || 'Đã thêm vào Google Photos'}`,
      );
    } else if (result.photosError) {
      const isPermError =
        result.photosError.includes('401') ||
        result.photosError.includes('Authentication session') ||
        result.photosError.includes('permission');
      const errDetail = isPermError
        ? 'Chưa cấp quyền Google Photos (Quản trị viên vui lòng gõ /login để cấp quyền bổ sung)'
        : result.photosError;
      lines.push(`• 📸 Google Photos: ⚠️ Lỗi lưu trữ (${errDetail})`);
    }

    return lines.join('\n\n');
  }

  public hasStorageScopes(userId?: number | string): boolean {
    return this.driveService ? this.driveService.hasStorageScopes(userId) : false;
  }

  /**
   * Lấy link thư mục Google Drive (zalobot/video) và album Google Photos (ZaloBot - Video)
   */
  public async getVideoStorageLinks(): Promise<{
    driveLink: string | null;
    photosLink: string | null;
    isPermissionMissing?: boolean;
  }> {
    const isPermissionMissing = this.driveService ? !this.driveService.hasStorageScopes() : false;
    const [driveLink, photosLink] = await Promise.all([
      this.driveService ? this.driveService.getFolderWebLink('zalobot/video') : null,
      this.photosService ? this.photosService.getAlbumLink('ZaloBot - Video') : null,
    ]);
    return { driveLink, photosLink, isPermissionMissing };
  }
}
