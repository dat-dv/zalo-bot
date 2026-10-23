import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { GoogleDriveService, GG_DRIVE_ROOT_FOLDER } from '../../../google/google-drive.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';
import { ThreadConfigService, hasLegacyGroupPrefix } from '../../thread-config.service';
import { ChannelStorageLinkService } from '../../storage/channel-storage-link.service';
import {
  buildChannelStorageTarget,
  getChannelUploadFolder,
  type ChannelStorageTarget,
} from '../../../google/channel-storage.util';

type StorageType = 'all' | 'bill' | 'image' | 'video';

interface StorageCategoryMeta {
  emoji: string;
  label: string;
}

const CATEGORY_META: Record<Exclude<StorageType, 'all'>, StorageCategoryMeta> = {
  bill: { emoji: '🧾', label: 'Hóa đơn' },
  image: { emoji: '🖼️', label: 'Hình ảnh' },
  video: { emoji: '🎬', label: 'Video' },
};

@Injectable()
export class GetStorageLinksToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.GET_STORAGE_LINKS;
  private readonly logger = new Logger(GetStorageLinksToolStrategy.name);
  private readonly defaultRecallDelayMs = 5 * 60 * 1000;

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly storageLinks?: ChannelStorageLinkService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
    @Optional() private readonly recallDelayMs?: number,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const storageType: StorageType = (context.toolArgs?.['type'] as StorageType) || 'all';

    // Kiểm tra Google có được kết nối chưa
    if (!this.googleAuthService.isSharedAuthorized()) {
      await this.zcaMessenger.sendMessage(
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

      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ TÀI KHOẢN GOOGLE CHƯA CẤP QUYỀN LƯU TRỮ (DRIVE & PHOTOS)\n\n` +
          `Tài khoản Google của Bot hiện đã kết nối (Lịch & Tasks) nhưng CHƯA ĐƯỢC CẤP QUYỀN truy cập Google Drive & Google Photos để tạo kho lưu trữ file.\n\n` +
          `${loginLinkNote}`,
      );
      return;
    }

    if (!this.driveService && !this.storageLinks) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Dịch vụ lưu trữ chưa sẵn sàng. Vui lòng thử lại sau.`,
      );
      return;
    }

    let progressResult: { success: boolean; msgId?: string; cliMsgId?: string } | undefined;
    if (this.zcaMessenger.sendMessageWithResult) {
      progressResult = await this.zcaMessenger.sendMessageWithResult(
        context.chatId,
        `⏳ Đang lấy đường dẫn kho lưu trữ Google...`,
      );
    } else {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⏳ Đang lấy đường dẫn kho lưu trữ Google...`,
      );
    }

    try {
      // Same root and album the dashboard links and media uploads use (honours customFolder).
      const target =
        (await this.threadConfigService?.getStorageTarget?.(context.chatId)) ??
        buildChannelStorageTarget(context.chatId);
      const channelDrivePath = target.driveRoot;

      const [rootDriveLink, channelDriveLink, album] = await Promise.all([
        this.driveService ? this.driveService.getFolderWebLink(GG_DRIVE_ROOT_FOLDER) : null,
        this.driveService ? this.driveService.getFolderWebLink(channelDrivePath) : null,
        this.findChannelAlbum(target),
      ]);

      // Lưu thông tin đường dẫn vào database để tra cứu sau này
      if (channelDriveLink) {
        const isGroup = this.threadConfigService
          ? await this.threadConfigService.isGroupThread(context.chatId)
          : hasLegacyGroupPrefix(context.chatId);
        if (isGroup) {
          void this.threadConfigService?.saveDriveFolderInfo(context.chatId, {
            folderUrl: channelDriveLink,
            folderPath: channelDrivePath,
          });
        } else {
          void this.usersService?.saveDriveFolderInfo(context.chatId, {
            folderUrl: channelDriveLink,
            folderPath: channelDrivePath,
          });
        }
      }

      const lines: string[] = [
        `📦 KHO LƯU TRỮ GOOGLE CỦA BOT`,
        ``,
        `📁 Google Drive (Thư mục nhóm):`,
        channelDriveLink ? `👉 ${channelDriveLink}` : `⚠️ Chưa có dữ liệu (chưa upload file nào)`,
        ``,
        `📁 Google Drive (Thư mục gốc hệ thống):`,
        rootDriveLink ? `👉 ${rootDriveLink}` : `⚠️ Chưa có dữ liệu`,
        ``,
        `📸 Google Photos (Album [${target.photosAlbumTitle}]):`,
        album
          ? `👉 ${album.url}`
          : `⚠️ Chưa có (album được tạo khi gửi ảnh/hóa đơn/video đầu tiên)`,
        ``,
      ];

      // A custom folder takes every upload directly (by month), so it has no category folders:
      // listing `zalobot/<id>/<category>` there would create empty folders nobody uses.
      if (target.splitByCategory) {
        const entriesToFetch =
          storageType === 'all' ? (['bill', 'image', 'video'] as const) : [storageType];
        for (const category of entriesToFetch) {
          const meta = CATEGORY_META[category];
          const driveFolder = getChannelUploadFolder(target, category);
          const driveLink = this.driveService
            ? await this.driveService.getFolderWebLink(driveFolder)
            : null;

          lines.push(`${meta.emoji} ${meta.label.toUpperCase()}:`);
          lines.push(
            `• 📁 Drive [${driveFolder}]:`,
            driveLink
              ? `  👉 ${driveLink}`
              : `  ⚠️ Chưa có (chưa upload ${meta.label.toLowerCase()} nào)`,
          );
          lines.push(``);
        }
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
      if (this.zcaMessenger.sendMessageWithResult) {
        sendResult = await this.zcaMessenger.sendMessageWithResult(
          context.chatId,
          lines.join('\n'),
        );
      } else {
        await this.zcaMessenger.sendMessage(context.chatId, lines.join('\n'));
      }

      // Thu hồi tin nhắn tiến trình (loading) ngay sau khi có kết quả
      if (progressResult?.msgId && this.zcaMessenger.undoMessage) {
        void this.zcaMessenger
          .undoMessage(context.chatId, progressResult.msgId, progressResult.cliMsgId)
          .catch((err) => {
            this.logger.debug(
              `Could not recall progress message ${progressResult?.msgId}: ${(err as Error).message}`,
            );
          });
      }

      // Tự động thu hồi tin nhắn kho lưu trữ sau 5 phút
      const delayMs = this.recallDelayMs ?? this.defaultRecallDelayMs;
      if (sendResult?.msgId && this.zcaMessenger.undoMessage) {
        const msgId = sendResult.msgId;
        const cliMsgId = sendResult.cliMsgId;
        const timer = setTimeout(async () => {
          try {
            await this.zcaMessenger.undoMessage(context.chatId, msgId, cliMsgId);
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
      if (progressResult?.msgId && this.zcaMessenger.undoMessage) {
        void this.zcaMessenger
          .undoMessage(context.chatId, progressResult.msgId, progressResult.cliMsgId)
          .catch(() => {});
      }
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Không thể lấy đường dẫn lưu trữ: ${(err as Error).message}`,
      );
    }
  }

  /**
   * The channel's album in the shared account, as recorded by uploads (`channel_storage_links`).
   * Read-only: the app cannot list albums on Google, and an album only exists once media did.
   */
  private async findChannelAlbum(target: ChannelStorageTarget): Promise<{ url: string } | null> {
    if (!this.storageLinks) return null;
    try {
      const email = await this.googleAuthService.getSharedAccountEmail();
      if (!email) return null;
      return await this.storageLinks.findAlbum(target.channelId, email, target.photosAlbumTitle);
    } catch (err: unknown) {
      // The Drive links are still worth sending without the album.
      this.logger.warn(
        `Could not read the Photos album of ${target.channelId}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
