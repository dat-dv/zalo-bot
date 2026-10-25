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

const CATEGORY_LABELS: Record<Exclude<StorageType, 'all'>, string> = {
  bill: 'Hoá đơn',
  image: 'Hình ảnh',
  video: 'Video',
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
        `⚠️ Google chưa được kết nối nên chưa có thư mục hay album lưu trữ. Admin gõ /login để kết nối tài khoản Google dùng chung.`,
      );
      return;
    }

    // Kiểm tra quyền lưu trữ Google Drive & Photos
    if (!this.googleAuthService.hasStorageScopes()) {
      let loginLinkNote = 'Admin gõ /login để cấp thêm quyền.';
      try {
        const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
        loginLinkNote =
          `Admin mở link này để cấp thêm quyền, hoặc gõ /login để nhận link:\n` + authUrl;
      } catch {
        // fallback
      }

      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Tài khoản Google đã kết nối nhưng chưa có quyền Google Drive và Google Photos để lưu file.\n` +
          loginLinkNote,
      );
      return;
    }

    if (!this.driveService && !this.storageLinks) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Dịch vụ lưu trữ chưa sẵn sàng, thử lại sau.`,
      );
      return;
    }

    let progressResult: { success: boolean; msgId?: string; cliMsgId?: string } | undefined;
    if (this.zcaMessenger.sendMessageWithResult) {
      progressResult = await this.zcaMessenger.sendMessageWithResult(
        context.chatId,
        `⏳ Đang lấy link kho lưu trữ Google...`,
      );
    } else {
      await this.zcaMessenger.sendMessage(context.chatId, `⏳ Đang lấy link kho lưu trữ Google...`);
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
        `📦 Kho lưu trữ Google của bot`,
        `• Thư mục nhóm: ${channelDriveLink ? channelDriveLink : 'chưa có, chưa upload file nào'}`,
        `• Thư mục gốc: ${rootDriveLink ? rootDriveLink : 'chưa có'}`,
        `• Album Google Photos "${target.photosAlbumTitle}": ${
          album ? album.url : 'chưa có, album được tạo khi gửi ảnh/hoá đơn/video đầu tiên'
        }`,
      ];

      // A custom folder takes every upload directly (by month), so it has no category folders:
      // listing `zalobot/<id>/<category>` there would create empty folders nobody uses.
      if (target.splitByCategory) {
        const entriesToFetch =
          storageType === 'all' ? (['bill', 'image', 'video'] as const) : [storageType];
        for (const category of entriesToFetch) {
          const label = CATEGORY_LABELS[category];
          const driveFolder = getChannelUploadFolder(target, category);
          const driveLink = this.driveService
            ? await this.driveService.getFolderWebLink(driveFolder)
            : null;

          lines.push(
            `• ${label} [${driveFolder}]: ${
              driveLink ? driveLink : `chưa có, chưa upload ${label.toLowerCase()} nào`
            }`,
          );
        }
      }

      lines.push(
        `Chưa xem được thư mục thì nhắn @bot share <gmail của bạn> để bot mở quyền thư mục nhóm này cho bạn, ví dụ: @bot share nguyenvana@gmail.com`,
      );
      lines.push(`Tin này tự thu hồi sau 5 phút.`);

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
        `⚠️ Chưa lấy được link lưu trữ: ${(err as Error).message}`,
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
