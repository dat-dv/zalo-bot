import { Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleDriveService, DriveUploadResult } from '../google/google-drive.service';
import {
  GooglePhotosService,
  type ChannelPhotoOptions,
  type PhotosAlbum,
  type PhotosUploadResult,
} from '../google/google-photos.service';
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

type ChannelAlbumOptions = Pick<ChannelPhotoOptions, 'album' | 'replaceAlbum'>;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';

const albumKey = (email: string, target: ChannelStorageTarget): string =>
  [email, target.channelId, target.photosAlbumTitle].join('\u0000');

/**
 * Stores channel media on the shared Google account only (never a member's own token), in the
 * channel's Drive root and its one Photos album, and records both in the channel storage history.
 *
 * The album of a channel in an account is the one recorded in `channel_storage_links`: the app
 * cannot list albums on Google (see `GooglePhotosService.findAppAlbum`), so that row is the only
 * way to find it again, and an album is created only when the row does not exist yet.
 */
@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  /** Album resolutions in flight per account + channel + title, so a burst creates one album. */
  private readonly albumResolutions = new Map<string, Promise<PhotosAlbum>>();

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

    if (email && this.linkService) {
      const album = await this.linkService.findAlbum(
        target.channelId,
        email,
        target.photosAlbumTitle,
      );
      if (album) current.photos = { resourceId: album.resourceId, url: album.url };
    }
    return current;
  }

  private async uploadDual(
    target: ChannelStorageTarget,
    category: PhotosCategory,
    upload: {
      drive: (folderPath: string) => Promise<DriveUploadResult>;
      photos: (album: ChannelAlbumOptions) => Promise<PhotosUploadResult>;
    },
  ): Promise<DualUploadResult> {
    const result: DualUploadResult = {};
    const email = await this.getStorageEmail();

    // `.then` turns a missing service (sync throw) into a rejection of that side only.
    const [drivePromise, photosPromise] = await Promise.allSettled([
      Promise.resolve().then(() => upload.drive(getChannelUploadFolder(target, category))),
      Promise.resolve().then(async () => upload.photos(await this.channelAlbum(target, email))),
    ]);

    if (drivePromise.status === 'fulfilled') {
      result.drive = drivePromise.value;
      await this.recordDriveRoot(target, email);
    } else {
      result.driveError = errorMessage(drivePromise.reason);
      this.logger.warn(`Failed to upload ${category} to Google Drive: ${result.driveError}`);
    }

    if (photosPromise.status === 'fulfilled') {
      result.photos = photosPromise.value;
      const { albumId, albumUrl } = result.photos;
      if (albumUrl) await this.recordPhotosAlbum(target, email, albumId, albumUrl);
    } else {
      result.photosError = errorMessage(photosPromise.reason);
      this.logger.warn(`Failed to upload ${category} to Google Photos: ${result.photosError}`);
    }

    return result;
  }

  /** The channel's album in the current account, plus how to replace it if Google refuses it. */
  private async channelAlbum(
    target: ChannelStorageTarget,
    email: string | null,
  ): Promise<ChannelAlbumOptions> {
    const photos = this.requirePhotos();
    const links = this.linkService;
    // Without the account or the history the album could not be found again: creating one
    // anyway is exactly how duplicates piled up, so the Photos side fails instead.
    if (!email) throw new Error('Không xác định được tài khoản Google dùng chung.');
    if (!links) throw new Error('ChannelStorageLinkService chưa được khởi tạo.');

    const key = albumKey(email, target);
    const album = await this.singleFlight(key, async () => {
      const known = await links.findAlbum(target.channelId, email, target.photosAlbumTitle);
      if (known) return { id: known.resourceId, url: known.url };
      return this.createChannelAlbum(photos, target, email);
    });

    return {
      album: { ...album, title: target.photosAlbumTitle },
      // Re-reads the history first: when another upload already replaced the refused album,
      // that one is used instead of creating one more.
      replaceAlbum: (failedAlbumId) =>
        this.singleFlight(`${key}\u0000replace`, async () => {
          const known = await links.findAlbum(target.channelId, email, target.photosAlbumTitle);
          if (known && known.resourceId !== failedAlbumId) {
            return { id: known.resourceId, url: known.url };
          }
          this.logger.warn(
            `Replacing Google Photos album ${failedAlbumId} of channel ${target.channelId} (${email}).`,
          );
          return this.createChannelAlbum(photos, target, email);
        }),
    };
  }

  /** Creates the album and records it before any media is added, so a failed add reuses it. */
  private async createChannelAlbum(
    photos: GooglePhotosService,
    target: ChannelStorageTarget,
    email: string,
  ): Promise<PhotosAlbum> {
    const album = await photos.createAlbum(target.photosAlbumTitle);
    try {
      if (!album.url) throw new Error('Google Photos returned no album URL');
      await this.linkService?.record({
        threadId: target.channelId,
        kind: 'photos',
        googleEmail: email,
        resourceId: album.id,
        url: album.url,
        label: target.photosAlbumTitle,
      });
    } catch (err) {
      // Louder than other history writes: without this row the next upload creates another album.
      this.logger.error(
        `Could not record new Photos album ${album.id} of channel ${target.channelId}: ${errorMessage(err)}`,
      );
    }
    return album;
  }

  private singleFlight(key: string, run: () => Promise<PhotosAlbum>): Promise<PhotosAlbum> {
    const inFlight = this.albumResolutions.get(key);
    if (inFlight !== undefined) return inFlight;
    const resolving = run().finally(() => this.albumResolutions.delete(key));
    this.albumResolutions.set(key, resolving);
    return resolving;
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
        ? 'hoá đơn'
        : type === 'video'
          ? 'video'
          : type === 'file'
            ? 'tệp'
            : type === 'audio'
              ? 'âm thanh'
              : 'ảnh';

    // Nothing saved on either side: say so instead of a "saved" title over two error rows.
    const lines: string[] = [
      result.drive || result.photos
        ? `☁️ Đã lưu ${typeLabel} lên Google:`
        : `⚠️ Chưa lưu được ${typeLabel} lên Google:`,
    ];
    const missingScopeHint = 'chưa cấp quyền, admin gõ /login để cấp thêm quyền';

    if (result.drive) {
      lines.push(`• Google Drive: ${result.drive.folderPath || 'zalobot'}/${result.drive.name}`);
      if (result.drive.webViewLink) lines.push(`Xem tại: ${result.drive.webViewLink}`);
    } else if (result.driveError) {
      const isPermError =
        result.driveError.includes('Insufficient Permission') ||
        result.driveError.includes('insufficient');
      lines.push(`• Google Drive lỗi: ${isPermError ? missingScopeHint : result.driveError}`);
    }

    if (result.photos) {
      lines.push(`• Google Photos: album ${result.photos.albumTitle}`);
      if (result.photos.productUrl) lines.push(`Xem tại: ${result.photos.productUrl}`);
    } else if (result.photosError) {
      const isPermError =
        result.photosError.includes('401') ||
        result.photosError.includes('Authentication session') ||
        result.photosError.includes('permission');
      lines.push(`• Google Photos lỗi: ${isPermError ? missingScopeHint : result.photosError}`);
    }

    return lines.join('\n');
  }

  public hasStorageScopes(userId?: number | string): boolean {
    return this.driveService ? this.driveService.hasStorageScopes(userId) : false;
  }
}
