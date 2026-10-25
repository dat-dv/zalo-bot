import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class LoginGoogleToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LOGIN_GOOGLE;
  private readonly logger = new Logger(LoginGoogleToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    if (!isAdmin) {
      const reply = `⛔ Chỉ admin mới kết nối được tài khoản Google dùng chung. Gõ /status để xem trạng thái.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }

    try {
      const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
      const isConnected = this.googleAuthService.isSharedAuthorized();
      const hasStorage =
        typeof this.googleAuthService.hasStorageScopes === 'function'
          ? this.googleAuthService.hasStorageScopes()
          : true;

      let statusNote = '';
      if (!isConnected) {
        statusNote = 'Hệ thống chưa kết nối tài khoản Google dùng chung.';
      } else if (!hasStorage) {
        statusNote =
          'Tài khoản hiện tại đã kết nối nhưng chưa có quyền lưu ảnh, video lên Drive và Photos, cần cấp thêm quyền.';
      } else {
        statusNote =
          'Đã kết nối đủ quyền Calendar, Drive và Photos. Cấp lại nếu muốn đổi sang Gmail khác.';
      }

      const reply =
        `🔐 Kết nối tài khoản Google dùng chung\n` +
        `${statusNote}\n` +
        `Mở link này, chọn tài khoản rồi bấm "Cho phép":\n` +
        `${authUrl}\n` +
        `Xong là Calendar, Drive và Google Photos được bật cho mọi người dùng.`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to generate Google auth URL: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa tạo được link đăng nhập Google: ${(err as Error).message}`,
      );
    }
  }
}
