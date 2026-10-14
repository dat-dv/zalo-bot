import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import { GoogleAuthService } from './google-auth.service';

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  folderPath?: string;
  folderId?: string;
  size?: number;
}

export interface UploadFileOptions {
  filename: string;
  mimeType: string;
  content: Buffer;
  folderPath?: string;
  folderId?: string;
  description?: string;
  makePublic?: boolean;
}

export const GG_DRIVE_ROOT_FOLDER = 'zalobot';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly folderCache: Map<string, string> = new Map();
  public readonly rootFolderName = GG_DRIVE_ROOT_FOLDER;

  constructor(private readonly authService: GoogleAuthService) {}

  public getDriveClient(userId?: number | string): drive_v3.Drive {
    const auth = this.authService.getOAuth2Client(userId);
    if (!auth || !this.authService.isAuthorized(userId)) {
      throw new BadRequestException(
        'Tài khoản Google của hệ thống chưa được kết nối. Quản trị viên vui lòng gõ /login trên Zalo để kích hoạt.',
      );
    }
    return google.drive({ version: 'v3', auth });
  }

  public isAuthorized(userId?: number | string): boolean {
    return this.authService.isAuthorized(userId);
  }

  public hasStorageScopes(userId?: number | string): boolean {
    return this.authService.hasStorageScopes(userId);
  }

  /**
   * Đảm bảo một folder tồn tại dưới parentId, nếu chưa có thì tạo mới
   */
  public async ensureFolder(
    folderName: string,
    parentId = 'root',
    userId?: number | string,
  ): Promise<string> {
    const drive = this.getDriveClient(userId);
    const sanitizedName = folderName.replace(/'/g, "\\'");
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${sanitizedName}' and trashed = false and '${parentId}' in parents`;

    try {
      const list = await drive.files.list({
        q,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (list.data.files && list.data.files.length > 0 && list.data.files[0].id) {
        return list.data.files[0].id;
      }

      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
      });

      if (!created.data.id) {
        throw new Error(`Google Drive không trả về folder ID cho ${folderName}`);
      }
      this.logger.log(
        `Created Google Drive folder "${folderName}" (id: ${created.data.id}) in parent "${parentId}".`,
      );
      return created.data.id;
    } catch (err) {
      const errMsg = (err as Error).message;
      if (errMsg.includes('Insufficient Permission') || errMsg.includes('insufficient_scope')) {
        this.logger.warn(
          `Google Drive permission missing when accessing folder "${folderName}": ${errMsg}`,
        );
      } else {
        this.logger.error(`Failed to ensure folder "${folderName}": ${errMsg}`);
      }
      throw err;
    }
  }

  /**
   * Đảm bảo cây thư mục lồng nhau tồn tại (VD: zalobot/bill/2026-10)
   */
  public async ensureFolderPath(path: string, userId?: number | string): Promise<string> {
    const cleanPath = path
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .trim();

    if (!cleanPath) return 'root';

    const cacheKey = `${userId || 'shared'}:${cleanPath}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) return cached;

    const segments = cleanPath.split('/').filter(Boolean);
    let currentParent = 'root';

    for (const segment of segments) {
      currentParent = await this.ensureFolder(segment, currentParent, userId);
    }

    this.folderCache.set(cacheKey, currentParent);
    return currentParent;
  }

  /**
   * Upload file buffer lên Google Drive
   */
  public async uploadFile(
    options: UploadFileOptions,
    userId?: number | string,
  ): Promise<DriveUploadResult> {
    const drive = this.getDriveClient(userId);
    const folderPath = options.folderPath || this.rootFolderName;
    const folderId = options.folderId || (await this.ensureFolderPath(folderPath, userId));

    const stream = Readable.from(options.content);

    try {
      const res = await drive.files.create({
        requestBody: {
          name: options.filename,
          parents: [folderId],
          description: options.description,
        },
        media: {
          mimeType: options.mimeType,
          body: stream,
        },
        fields: 'id, name, webViewLink, webContentLink, size',
      });

      const fileId = res.data.id;
      if (!fileId) {
        throw new Error('Google Drive upload failed: missing file id.');
      }

      // Cấp quyền xem cho bất kỳ ai có link nếu makePublic !== false
      if (options.makePublic !== false) {
        try {
          await drive.permissions.create({
            fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
          });
        } catch (permErr) {
          this.logger.warn(
            `Could not set public permission on Drive file ${fileId}: ${(permErr as Error).message}`,
          );
        }
      }

      this.logger.log(
        `Uploaded file "${options.filename}" to Google Drive folder "${folderPath}" (${fileId}).`,
      );

      return {
        fileId,
        name: res.data.name || options.filename,
        webViewLink: res.data.webViewLink || undefined,
        webContentLink: res.data.webContentLink || undefined,
        folderPath,
        folderId,
        size: res.data.size ? Number(res.data.size) : options.content.length,
      };
    } catch (err) {
      this.logger.error(`Drive upload error for ${options.filename}: ${(err as Error).message}`);
      throw err;
    }
  }

  private getYearMonthString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
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
   * Lưu ảnh hóa đơn / bill vào zalobot/bill/YYYY-MM
   */
  public async uploadReceipt(
    buffer: Buffer,
    senderId: string,
    options?: {
      note?: string;
      extension?: string;
      occurredAt?: Date;
      folderPath?: string;
      suffix?: string;
    },
    userId?: number | string,
  ): Promise<DriveUploadResult> {
    const date = options?.occurredAt || new Date();
    const ym = this.getYearMonthString(date);
    const ts = this.getFormattedTimestamp(date);
    const ext = (options?.extension || 'jpg').replace(/^\./, '');
    const suffix = options?.suffix ? `_${options.suffix.replace(/^_/, '')}` : '';
    const filename = `bill_${ts}_${senderId}${suffix}.${ext}`;
    const folderPath = options?.folderPath
      ? (options.folderPath.includes(ym) ? options.folderPath : `${options.folderPath}/${ym}`)
      : `${this.rootFolderName}/bill/${ym}`;

    return this.uploadFile(
      {
        filename,
        mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
        content: buffer,
        folderPath,
        description: options?.note || `Hóa đơn từ người dùng Zalo ID: ${senderId}`,
        makePublic: true,
      },
      userId,
    );
  }

  /**
   * Lưu ảnh thông thường vào zalobot/image/YYYY-MM hoặc folder riêng
   */
  public async uploadImage(
    buffer: Buffer,
    senderId: string,
    options?: {
      note?: string;
      extension?: string;
      folderPath?: string;
      suffix?: string;
    },
    userId?: number | string,
  ): Promise<DriveUploadResult> {
    const now = new Date();
    const ym = this.getYearMonthString(now);
    const ts = this.getFormattedTimestamp(now);
    const ext = (options?.extension || 'jpg').replace(/^\./, '');
    const suffix = options?.suffix ? `_${options.suffix.replace(/^_/, '')}` : '';
    const filename = `image_${ts}_${senderId}${suffix}.${ext}`;
    const folderPath = options?.folderPath
      ? (options.folderPath.includes(ym) ? options.folderPath : `${options.folderPath}/${ym}`)
      : `${this.rootFolderName}/image/${ym}`;

    return this.uploadFile(
      {
        filename,
        mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
        content: buffer,
        folderPath,
        description: options?.note || `Ảnh từ người dùng Zalo ID: ${senderId}`,
        makePublic: true,
      },
      userId,
    );
  }

  /**
   * Lưu video vào zalobot/video/YYYY-MM hoặc folder riêng
   */
  public async uploadVideo(
    buffer: Buffer,
    senderId: string,
    options?: {
      note?: string;
      extension?: string;
      folderPath?: string;
      suffix?: string;
    },
    userId?: number | string,
  ): Promise<DriveUploadResult> {
    const now = new Date();
    const ym = this.getYearMonthString(now);
    const ts = this.getFormattedTimestamp(now);
    const ext = (options?.extension || 'mp4').replace(/^\./, '');
    const suffix = options?.suffix ? `_${options.suffix.replace(/^_/, '')}` : '';
    const filename = `video_${ts}_${senderId}${suffix}.${ext}`;
    const folderPath = options?.folderPath
      ? (options.folderPath.includes(ym) ? options.folderPath : `${options.folderPath}/${ym}`)
      : `${this.rootFolderName}/video/${ym}`;

    return this.uploadFile(
      {
        filename,
        mimeType: 'video/mp4',
        content: buffer,
        folderPath,
        description: options?.note || `Video từ người dùng Zalo ID: ${senderId}`,
        makePublic: true,
      },
      userId,
    );
  }

  /**
   * Lấy webViewLink của folder theo đường dẫn (ví dụ: zalobot/bill)
   * Trả về https://drive.google.com/drive/folders/{folderId}
   */
  public async getFolderWebLink(
    folderPath: string,
    userId?: number | string,
  ): Promise<string | null> {
    try {
      const folderId = await this.ensureFolderPath(folderPath, userId);
      return `https://drive.google.com/drive/folders/${folderId}`;
    } catch {
      return null;
    }
  }
}
