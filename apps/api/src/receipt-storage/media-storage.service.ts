import { Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleDriveService, DriveUploadResult } from '../google/google-drive.service';
import { GooglePhotosService, PhotosUploadResult } from '../google/google-photos.service';

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
   * Lưu hóa đơn / bill lên cả Google Drive (zalobot/bill/YYYY-MM) và Google Photos (Album ZaloBot - Hóa đơn)
   */
  public async uploadBill(
    senderId: string,
    buffer: Buffer,
    options?: { note?: string; occurredAt?: Date; extension?: string },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};

    const [drivePromise, photosPromise] = await Promise.allSettled([
      this.driveService
        ? this.driveService.uploadReceipt(buffer, senderId, options)
        : Promise.reject(new Error('GoogleDriveService chưa được khởi tạo.')),
      this.photosService
        ? this.photosService.uploadBillPhoto(buffer, senderId, options)
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
   * Lưu ảnh lên cả Google Drive (zalobot/image/YYYY-MM) và Google Photos (Album ZaloBot - Hình ảnh)
   */
  public async uploadImage(
    senderId: string,
    buffer: Buffer,
    options?: { note?: string; extension?: string },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};

    const [drivePromise, photosPromise] = await Promise.allSettled([
      this.driveService
        ? this.driveService.uploadImage(buffer, senderId, options)
        : Promise.reject(new Error('GoogleDriveService chưa được khởi tạo.')),
      this.photosService
        ? this.photosService.uploadGeneralPhoto(buffer, senderId, options)
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
   * Lưu video lên cả Google Drive (zalobot/video/YYYY-MM) và Google Photos (Album ZaloBot - Video)
   */
  public async uploadVideo(
    senderId: string,
    buffer: Buffer,
    options?: { note?: string; extension?: string },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};

    const [drivePromise, photosPromise] = await Promise.allSettled([
      this.driveService
        ? this.driveService.uploadVideo(buffer, senderId, options)
        : Promise.reject(new Error('GoogleDriveService chưa được khởi tạo.')),
      this.photosService
        ? this.photosService.uploadVideo(buffer, senderId, options)
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
   * Định dạng tin nhắn tóm tắt kết quả lưu trữ Google Drive & Photos cho Zalo
   */
  public formatUploadSummary(result: DualUploadResult, type: 'bill' | 'image' | 'video'): string {
    const typeLabel = type === 'bill' ? 'Hóa đơn' : type === 'video' ? 'Video' : 'Hình ảnh';

    const lines: string[] = [`☁️ ĐÃ LƯU TRỮ ${typeLabel.toUpperCase()} LÊN GOOGLE:`];

    if (result.drive) {
      lines.push(
        `• 📁 Google Drive: [${result.drive.folderPath || 'zalobot'}/${result.drive.name}]\n` +
          `  👉 Xem tại: ${result.drive.webViewLink || 'Đã lưu trên Drive'}`,
      );
    } else if (result.driveError) {
      lines.push(`• 📁 Google Drive: ⚠️ Lỗi lưu trữ (${result.driveError})`);
    }

    if (result.photos) {
      lines.push(
        `• 📸 Google Photos: [Album: ${result.photos.albumTitle}]\n` +
          `  👉 Xem tại: ${result.photos.productUrl || 'Đã thêm vào Google Photos'}`,
      );
    } else if (result.photosError) {
      lines.push(`• 📸 Google Photos: ⚠️ Lỗi lưu trữ (${result.photosError})`);
    }

    return lines.join('\n\n');
  }
}
