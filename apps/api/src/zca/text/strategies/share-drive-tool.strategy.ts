import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { GoogleDriveService } from '../../../google/google-drive.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';
import {
  ThreadConfigService,
  getThreadDriveRoot,
  hasLegacyGroupPrefix,
} from '../../thread-config.service';
import { isValidEmail, resolveChannelDriveRoot } from '../../../google/channel-storage.util';

@Injectable()
export class ShareDriveToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SHARE_DRIVE;
  private readonly logger = new Logger(ShareDriveToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    if (
      !this.googleAuthService.isSharedAuthorized() ||
      !this.googleAuthService.hasStorageScopes()
    ) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Google chưa được kết nối hoặc chưa cấp quyền Drive. Nhờ admin gõ /login để kết nối trước.`,
      );
      return;
    }

    if (!this.driveService) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Google Drive chưa sẵn sàng, thử lại sau.`,
      );
      return;
    }

    // Extract email from text: "@bot share abc@gmail.com" or "/share-drive abc@gmail.com"
    const emailMatch = context.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    if (!email || !isValidEmail(email)) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Email không hợp lệ. Gõ theo mẫu @bot share <gmail của bạn>, ví dụ: @bot share nguyenvana@gmail.com`,
      );
      return;
    }

    await this.zcaMessenger.sendMessage(
      context.chatId,
      `⏳ Đang mở quyền Google Drive cho ${email}...`,
    );

    try {
      // Same root the dashboard links and media uploads use (honours the group's customFolder).
      const threadConfig = await this.threadConfigService?.findStoredConfig?.(context.chatId);
      const channelDrivePath = threadConfig
        ? getThreadDriveRoot(threadConfig)
        : resolveChannelDriveRoot(context.chatId);

      const res = await this.driveService.shareFolderWithUser(channelDrivePath, email, 'reader');
      const webViewLink = await this.driveService.getFolderWebLink(channelDrivePath);

      // Lưu thông tin đường dẫn vào database để tra cứu sau này
      if (webViewLink) {
        const isGroup = this.threadConfigService
          ? await this.threadConfigService.isGroupThread(context.chatId)
          : hasLegacyGroupPrefix(context.chatId);
        if (isGroup) {
          void this.threadConfigService?.saveDriveFolderInfo(context.chatId, {
            folderId: res.fileId,
            folderUrl: webViewLink,
            folderPath: channelDrivePath,
          });
        } else {
          void this.usersService?.saveDriveFolderInfo(context.chatId, {
            folderId: res.fileId,
            folderUrl: webViewLink,
            folderPath: channelDrivePath,
          });
        }
      }

      await this.zcaMessenger.sendMessage(
        context.chatId,
        `✅ Đã cấp quyền xem Google Drive cho ${email}\n` +
          `Thư mục ${channelDrivePath} có hoá đơn, hình ảnh và video của nhóm.` +
          (webViewLink ? `\nLink: ${webViewLink}` : ''),
      );
    } catch (err) {
      this.logger.error(`Failed to share Google Drive folder: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa chia sẻ được thư mục: ${(err as Error).message}`,
      );
    }
  }
}
