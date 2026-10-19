import { Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleDriveService, DriveUploadResult } from '../google/google-drive.service';
import { GooglePhotosService, PhotosUploadResult } from '../google/google-photos.service';
import { getChannelDriveFolderPath } from '../google/channel-storage.util';

export interface DualUploadResult {
  drive?: DriveUploadResult;
  photos?: PhotosUploadResult;
  driveError?: string;
  photosError?: string;
}

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly photosService?: GooglePhotosService,
  ) {}

  /**
   * Lưu hóa đơn / bill lên cả Google Drive (zalobot/<channelId>/bill/YYYY-MM) và Google Photos (Album ZaloBot - Hóa đơn)
   */
  public async uploadBill(
    senderId: string,
    buffer: Buffer,
    options?: {
      note?: string;
      occurredAt?: Date;
      extension?: string;
      folderPath?: string;
      suffix?: string;
      channelId?: string;
      photosAlbumTitle?: string;
      photosAlbumId?: string;
    },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    const folderPath =
      options?.folderPath ||
      (options?.channelId ? getChannelDriveFolderPath(options.channelId, 'bill') : undefined);
    const driveOptions = { ...options, folderPath };

    const [drivePromise, photosPromise] = await Promise.allSettled([
      this.driveService
        ? this.driveService.uploadReceipt(buffer, senderId, driveOptions)
        : Promise.reject(new Error('GoogleDriveService chưa được khởi tạo.')),
      this.photosService
        ? this.photosService.uploadBillPhoto(buffer, senderId, {
            ...options,
            albumTitle: options?.photosAlbumTitle,
            albumId: options?.photosAlbumId,
          })
        : Promise.reject(new Error('GooglePhotosService chưa được khởi tạo.')),
    ]);

    if (drivePromise.status === 'fulfilled') {
      result.drive = drivePromise.value;
    } else {
      result.driveError = (drivePromise.reason as Error).message;
      this.logger.warn(`Failed to upload bill to Google Drive: ${result.driveError}`);
    }

    if (photosPromise.status === 'fulfilled') {
      result.photos = photosPromise.value;
    } else {
      result.photosError = (photosPromise.reason as Error).message;
      this.logger.warn(`Failed to upload bill to Google Photos: ${result.photosError}`);
    }

    return result;
  }

  /**
   * Lưu ảnh lên cả Google Drive (zalobot/<channelId>/image/YYYY-MM) và Google Photos (Album chỉ định hoặc ZaloBot - Hình ảnh)
   */
  public async uploadImage(
    senderId: string,
    buffer: Buffer,
    options?: {
      note?: string;
      extension?: string;
      folderPath?: string;
      suffix?: string;
      channelId?: string;
      msgId?: string;
      filename?: string;
      photosAlbumTitle?: string;
      photosAlbumId?: string;
    },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    const folderPath =
      options?.folderPath ||
      (options?.channelId ? getChannelDriveFolderPath(options.channelId, 'image') : undefined);
    const driveOptions = { ...options, folderPath };

    const [drivePromise, photosPromise] = await Promise.allSettled([
      this.driveService
        ? this.driveService.uploadImage(buffer, senderId, driveOptions)
        : Promise.reject(new Error('GoogleDriveService chưa được khởi tạo.')),
      this.photosService
        ? this.photosService.uploadGeneralPhoto(buffer, senderId, {
            ...options,
            albumTitle: options?.photosAlbumTitle,
            albumId: options?.photosAlbumId,
          })
        : Promise.reject(new Error('GooglePhotosService chưa được khởi tạo.')),
    ]);

    if (drivePromise.status === 'fulfilled') {
      result.drive = drivePromise.value;
    } else {
      result.driveError = (drivePromise.reason as Error).message;
      this.logger.warn(`Failed to upload image to Google Drive: ${result.driveError}`);
    }

    if (photosPromise.status === 'fulfilled') {
      result.photos = photosPromise.value;
    } else {
      result.photosError = (photosPromise.reason as Error).message;
      this.logger.warn(`Failed to upload image to Google Photos: ${result.photosError}`);
    }

    return result;
  }

  /**
   * Lưu video lên cả Google Drive (zalobot/<channelId>/video/YYYY-MM) và Google Photos (Album chỉ định hoặc ZaloBot - Video)
   */
  public async uploadVideo(
    senderId: string,
    buffer: Buffer,
    options?: {
      note?: string;
      extension?: string;
      folderPath?: string;
      suffix?: string;
      channelId?: string;
      msgId?: string;
      filename?: string;
      photosAlbumTitle?: string;
      photosAlbumId?: string;
    },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    const folderPath =
      options?.folderPath ||
      (options?.channelId ? getChannelDriveFolderPath(options.channelId, 'video') : undefined);
    const driveOptions = { ...options, folderPath };

    const [drivePromise, photosPromise] = await Promise.allSettled([
      this.driveService
        ? this.driveService.uploadVideo(buffer, senderId, driveOptions)
        : Promise.reject(new Error('GoogleDriveService chưa được khởi tạo.')),
      this.photosService
        ? this.photosService.uploadVideo(buffer, senderId, {
            ...options,
            albumTitle: options?.photosAlbumTitle,
            albumId: options?.photosAlbumId,
          })
        : Promise.reject(new Error('GooglePhotosService chưa được khởi tạo.')),
    ]);

    if (drivePromise.status === 'fulfilled') {
      result.drive = drivePromise.value;
    } else {
      result.driveError = (drivePromise.reason as Error).message;
      this.logger.warn(`Failed to upload video to Google Drive: ${result.driveError}`);
    }

    if (photosPromise.status === 'fulfilled') {
      result.photos = photosPromise.value;
    } else {
      result.photosError = (photosPromise.reason as Error).message;
      this.logger.warn(`Failed to upload video to Google Photos: ${result.photosError}`);
    }

    return result;
  }

  /**
   * Lưu tệp tài liệu / âm thanh lên Google Drive (zalobot/<channelId>/file/YYYY-MM)
   */
  public async uploadFile(
    senderId: string,
    buffer: Buffer,
    options?: {
      note?: string;
      filename?: string;
      extension?: string;
      mimeType?: string;
      folderPath?: string;
      suffix?: string;
      channelId?: string;
      msgId?: string;
    },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    const folderPath =
      options?.folderPath ||
      (options?.channelId ? getChannelDriveFolderPath(options.channelId, 'file') : undefined);
    const driveOptions = { ...options, folderPath };

    if (this.driveService) {
      try {
        result.drive = await this.driveService.uploadDocument(buffer, senderId, driveOptions);
      } catch (err) {
        result.driveError = (err as Error).message;
        this.logger.warn(`Failed to upload file to Google Drive: ${result.driveError}`);
      }
    }
    return result;
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
