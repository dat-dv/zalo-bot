import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleDriveService, GG_DRIVE_ROOT_FOLDER } from '../../../google/google-drive.service';
import { GooglePhotosService } from '../../../google/google-photos.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';
import { ThreadConfigService } from '../../../zca/thread-config.service';
import {
  buildChannelFolder,
  getChannelDriveFolderPath,
} from '../../../google/channel-storage.util';

type StorageType = 'all' | 'bill' | 'image' | 'video';

interface StorageCategoryMeta {
  emoji: string;
  label: string;
  photosAlbum: string;
}

const CATEGORY_META: Record<Exclude<StorageType, 'all'>, StorageCategoryMeta> = {
  bill: {
    emoji: '🧾',
    label: 'Hóa đơn',
    photosAlbum: 'ZaloBot - Hóa đơn',
  },
  image: {
    emoji: '🖼️',
    label: 'Hình ảnh',
    photosAlbum: 'ZaloBot - Hình ảnh',
  },
  video: {
    emoji: '🎬',
    label: 'Video',
    photosAlbum: 'ZaloBot - Video',
  },
};

@Injectable()
export class GetStorageLinksToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.GET_STORAGE_LINKS;
  private readonly logger = new Logger(GetStorageLinksToolStrategy.name);
  private readonly defaultRecallDelayMs = 5 * 60 * 1000;

  constructor(
    private readonly zaloService: ZaloService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly photosService?: GooglePhotosService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
    @Optional() private readonly recallDelayMs?: number,
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

    let progressResult: { success: boolean; msgId?: string; cliMsgId?: string } | undefined;
    if (this.zaloService.sendMessageWithResult) {
      progressResult = await this.zaloService.sendMessageWithResult(
        context.chatId,
        `⏳ Đang lấy đường dẫn kho lưu trữ Google...`,
      );
    } else {
      await this.zaloService.sendMessage(
        context.chatId,
        `⏳ Đang lấy đường dẫn kho lưu trữ Google...`,
      );
    }

    try {
      const channelFolder = buildChannelFolder(context.chatId);
      const channelDrivePath = `${GG_DRIVE_ROOT_FOLDER}/${channelFolder}`;

      const [rootDriveLink, channelDriveLink] = await Promise.all([
        this.driveService ? this.driveService.getFolderWebLink(GG_DRIVE_ROOT_FOLDER) : null,
        this.driveService ? this.driveService.getFolderWebLink(channelDrivePath) : null,
      ]);

      // Lưu thông tin đường dẫn vào database để tra cứu sau này
      if (channelDriveLink) {
        const isGroup = context.chatId.startsWith('g-') || context.chatId.startsWith('group_');
        if (isGroup && this.threadConfigService) {
          void this.threadConfigService.saveDriveFolderInfo(context.chatId, {
            folderUrl: channelDriveLink,
            folderPath: channelDrivePath,
          });
        } else if (this.usersService) {
          void this.usersService.saveDriveFolderInfo(context.chatId, {
            folderUrl: channelDriveLink,
            folderPath: channelDrivePath,
          });
        }
      }

      const entriesToFetch =
        storageType === 'all' ? (['bill', 'image', 'video'] as const) : [storageType];

      const lines: string[] = [
        `📦 KHO LƯU TRỮ GOOGLE CỦA BOT`,
        ``,
        `📁 Google Drive (Thư mục nhóm):`,
        channelDriveLink ? `👉 ${channelDriveLink}` : `⚠️ Chưa có dữ liệu (chưa upload file nào)`,
        ``,
        `📁 Google Drive (Thư mục gốc hệ thống):`,
        rootDriveLink ? `👉 ${rootDriveLink}` : `⚠️ Chưa có dữ liệu`,
        ``,
      ];

      for (const category of entriesToFetch) {
        const meta = CATEGORY_META[category];
        const driveFolder = getChannelDriveFolderPath(context.chatId, category);

        const [driveLink, photosLink] = await Promise.all([
          this.driveService ? this.driveService.getFolderWebLink(driveFolder) : null,
          this.photosService ? this.photosService.getAlbumLink(meta.photosAlbum) : null,
        ]);

        lines.push(`${meta.emoji} ${meta.label.toUpperCase()}:`);
        lines.push(
          `• 📁 Drive [${driveFolder}]:`,
          driveLink
            ? `  👉 ${driveLink}`
            : `  ⚠️ Chưa có (chưa upload ${meta.label.toLowerCase()} nào)`,
        );
        lines.push(
          `• 📸 Photos [${meta.photosAlbum}]:`,
          photosLink ? `  👉 ${photosLink}` : `  ⚠️ Chưa có (album chưa được tạo)`,
        );
        lines.push(``);
      }

      lines.push(`💡 Các thư mục/album được tạo tự động khi bạn gửi ảnh/hóa đơn/video lên bot.`);
      lines.push(``);
      lines.push(`🔒 Chưa có quyền truy cập Google Drive?`);
      lines.push(`👉 Hãy gửi: @bot share <gmail của bạn>`);
      lines.push(
        `(Ví dụ: @bot share nguyenvana@gmail.com) để bot tự động bật quyền truy cập thư mục của nhóm này cho bạn nhé!`,
      );
      lines.push(``);
      lines.push(`⏱️ Tin nhắn này sẽ tự động thu hồi sau 5 phút vì lý do bảo mật.`);

      let sendResult: { success: boolean; msgId?: string; cliMsgId?: string } | undefined;
      if (this.zaloService.sendMessageWithResult) {
        sendResult = await this.zaloService.sendMessageWithResult(context.chatId, lines.join('\n'));
      } else {
        await this.zaloService.sendMessage(context.chatId, lines.join('\n'));
      }

      // Thu hồi tin nhắn tiến trình (loading) ngay sau khi có kết quả
      if (progressResult?.msgId && this.zaloService.undoMessage) {
        void this.zaloService
          .undoMessage(context.chatId, progressResult.msgId, progressResult.cliMsgId)
          .catch((err) => {
            this.logger.debug(
              `Could not recall progress message ${progressResult?.msgId}: ${(err as Error).message}`,
            );
          });
      }

      // Tự động thu hồi tin nhắn kho lưu trữ sau 5 phút
      const delayMs = this.recallDelayMs ?? this.defaultRecallDelayMs;
      if (sendResult?.msgId && this.zaloService.undoMessage) {
        const msgId = sendResult.msgId;
        const cliMsgId = sendResult.cliMsgId;
        const timer = setTimeout(async () => {
          try {
            await this.zaloService.undoMessage(context.chatId, msgId, cliMsgId);
            this.logger.log(
              `Auto-recalled storage links message ${msgId} in chat ${context.chatId}`,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to auto-recall storage links message ${msgId}: ${(err as Error).message}`,
            );
          }
        }, delayMs);
        if (typeof timer?.unref === 'function') {
          timer.unref();
        }
      }
    } catch (err) {
      this.logger.error(`Failed to fetch storage links: ${(err as Error).message}`);
      if (progressResult?.msgId && this.zaloService.undoMessage) {
        void this.zaloService
          .undoMessage(context.chatId, progressResult.msgId, progressResult.cliMsgId)
          .catch(() => {});
      }
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể lấy đường dẫn lưu trữ: ${(err as Error).message}`,
      );
    }
  }
}
