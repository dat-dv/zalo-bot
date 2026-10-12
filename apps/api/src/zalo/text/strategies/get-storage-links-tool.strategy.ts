import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleDriveService, GG_DRIVE_ROOT_FOLDER } from '../../../google/google-drive.service';
import { GooglePhotosService } from '../../../google/google-photos.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

type StorageType = 'all' | 'bill' | 'image' | 'video';

interface StorageEntry {
  emoji: string;
  label: string;
  driveFolder: string;
  photosAlbum: string;
}

const STORAGE_ENTRIES: Record<Exclude<StorageType, 'all'>, StorageEntry> = {
  bill: {
    emoji: '🧾',
    label: 'Hóa đơn',
    driveFolder: `${GG_DRIVE_ROOT_FOLDER}/bill`,
    photosAlbum: 'ZaloBot - Hóa đơn',
  },
  image: {
    emoji: '🖼️',
    label: 'Hình ảnh',
    driveFolder: `${GG_DRIVE_ROOT_FOLDER}/image`,
    photosAlbum: 'ZaloBot - Hình ảnh',
  },
  video: {
    emoji: '🎬',
    label: 'Video',
    driveFolder: `${GG_DRIVE_ROOT_FOLDER}/video`,
    photosAlbum: 'ZaloBot - Video',
  },
};

@Injectable()
export class GetStorageLinksToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.GET_STORAGE_LINKS;
  private readonly logger = new Logger(GetStorageLinksToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly photosService?: GooglePhotosService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const storageType: StorageType = (context.toolArgs?.['type'] as StorageType) || 'all';

    // Kiểm tra Google có được kết nối chưa
    if (!this.googleAuthService.isSharedAuthorized()) {
      await this.zaloService.sendMessage(
        context.chatId,
        `❌ GOOGLE CHƯA ĐƯỢC KẾT NỐI\n\n` +
          `Hệ thống chưa liên kết với Google nên chưa có thư mục/album lưu trữ.\n\n` +
          `👉 Quản trị viên vui lòng gõ /login để kết nối tài khoản Google dùng chung.`,
      );
      return;
    }

    // Kiểm tra quyền lưu trữ Google Drive & Photos
    if (!this.googleAuthService.hasStorageScopes()) {
      let loginLinkNote = '👉 Quản trị viên vui lòng gõ /login để cấp quyền bổ sung.';
      try {
        const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
        loginLinkNote =
          `👉 Quản trị viên vui lòng mở liên kết sau để cấp quyền bổ sung:\n` +
          `🔗 ${authUrl}\n\n` +
          `(Hoặc gõ /login để nhận link cấp quyền)`;
      } catch {
        // fallback
      }

      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ TÀI KHOẢN GOOGLE CHƯA CẤP QUYỀN LƯU TRỮ (DRIVE & PHOTOS)\n\n` +
          `Tài khoản Google của Bot hiện đã kết nối (Lịch & Tasks) nhưng CHƯA ĐƯỢC CẤP QUYỀN truy cập Google Drive & Google Photos để tạo kho lưu trữ file.\n\n` +
          `${loginLinkNote}`,
      );
      return;
    }

    if (!this.driveService && !this.photosService) {
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Dịch vụ lưu trữ chưa sẵn sàng. Vui lòng thử lại sau.`,
      );
      return;
    }

    await this.zaloService.sendMessage(
      context.chatId,
      `⏳ Đang lấy đường dẫn kho lưu trữ Google...`,
    );

    try {
      const entriesToFetch =
        storageType === 'all'
          ? Object.entries(STORAGE_ENTRIES)
          : [[storageType, STORAGE_ENTRIES[storageType]] as [string, StorageEntry]];

      // Lấy link thư mục gốc zalobot trên Drive
      const rootDriveLink = this.driveService
        ? await this.driveService.getFolderWebLink(GG_DRIVE_ROOT_FOLDER)
        : null;

      const lines: string[] = [
        `📦 KHO LƯU TRỮ GOOGLE CỦA BOT`,
        ``,
        `📁 Google Drive (Thư mục gốc):`,
        rootDriveLink ? `👉 ${rootDriveLink}` : `⚠️ Chưa có dữ liệu (chưa upload file nào)`,
        ``,
      ];

      for (const [, entry] of entriesToFetch) {
        const { emoji, label, driveFolder, photosAlbum } = entry;

        const [driveLink, photosLink] = await Promise.all([
          this.driveService ? this.driveService.getFolderWebLink(driveFolder) : null,
          this.photosService ? this.photosService.getAlbumLink(photosAlbum) : null,
        ]);

        lines.push(`${emoji} ${label.toUpperCase()}:`);
        lines.push(
          `• 📁 Drive [${driveFolder}]:`,
          driveLink ? `  👉 ${driveLink}` : `  ⚠️ Chưa có (chưa upload ${label.toLowerCase()} nào)`,
        );
        lines.push(
          `• 📸 Photos [${photosAlbum}]:`,
          photosLink ? `  👉 ${photosLink}` : `  ⚠️ Chưa có (album chưa được tạo)`,
        );
        lines.push(``);
      }

      lines.push(`💡 Các thư mục/album được tạo tự động khi bạn gửi ảnh/hóa đơn/video lên bot.`);

      await this.zaloService.sendMessage(context.chatId, lines.join('\n'));
    } catch (err) {
      this.logger.error(`Failed to fetch storage links: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể lấy đường dẫn lưu trữ: ${(err as Error).message}`,
      );
    }
  }
}
