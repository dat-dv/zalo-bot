import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleDriveService } from '../../../google/google-drive.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';
import {
  ThreadConfigService,
  getThreadDriveRoot,
  hasLegacyGroupPrefix,
} from '../../../zca/thread-config.service';
import { isValidEmail, resolveChannelDriveRoot } from '../../../google/channel-storage.util';

@Injectable()
export class ShareDriveToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SHARE_DRIVE;
  private readonly logger = new Logger(ShareDriveToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
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
      await this.zaloService.sendMessage(
        context.chatId,
        `❌ TÀI KHOẢN GOOGLE CHƯA ĐƯỢC KẾT NỐI HOẶC CHƯA CẤP QUYỀN DRIVE\n\n` +
          `Vui lòng liên hệ Quản trị viên gõ /login để kích hoạt kết nối Google Drive trước nhé!`,
      );
      return;
    }

    if (!this.driveService) {
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Dịch vụ Google Drive chưa sẵn sàng. Vui lòng thử lại sau.`,
      );
      return;
    }

    // Extract email from text: "@bot share abc@gmail.com" or "/share-drive abc@gmail.com"
    const emailMatch = context.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    if (!email || !isValidEmail(email)) {
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Email không hợp lệ!\n\n` +
          `👉 Vui lòng sử dụng cú pháp: @bot share <gmail của bạn>\n` +
          `Ví dụ: @bot share nguyenvana@gmail.com`,
      );
      return;
    }

    await this.zaloService.sendMessage(
      context.chatId,
      `⏳ Đang thiết lập quyền truy cập Google Drive cho tài khoản ${email}...`,
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

      await this.zaloService.sendMessage(
        context.chatId,
        `✅ ĐÃ CẤP QUYỀN TRUY CẬP GOOGLE DRIVE THÀNH CÔNG!\n\n` +
          `👤 Tài khoản: ${email}\n` +
          `📁 Thư mục nhóm: ${channelDrivePath}\n` +
          (webViewLink ? `👉 Mở thư mục: ${webViewLink}\n\n` : `\n`) +
          `Bây giờ bạn đã có quyền xem toàn bộ hóa đơn, hình ảnh và video của nhóm này trên Google Drive rồi nhé! 🎉`,
      );
    } catch (err) {
      this.logger.error(`Failed to share Google Drive folder: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `❌ Không thể chia sẻ thư mục: ${(err as Error).message}`,
      );
    }
  }
}
