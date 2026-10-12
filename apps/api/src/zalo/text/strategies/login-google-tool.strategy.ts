import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class LoginGoogleToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LOGIN_GOOGLE;
  private readonly logger = new Logger(LoginGoogleToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    if (!isAdmin) {
      const reply =
        `⛔ QUYỀN TRUY CẬP BỊ GIỚI HẠN\n\n` +
        `Chỉ Quản trị viên (Admin) mới có quyền kết nối tài khoản Google cho hệ thống.\n\n` +
        `Tài khoản Google sau khi Quản trị viên kết nối sẽ được kích hoạt dùng chung cho toàn bộ thành viên (Calendar, Tasks, Google Drive & Google Photos).\n\n` +
        `💡 Vui lòng liên hệ Quản trị viên để kết nối tài khoản. Bạn có thể gõ /status để kiểm tra trạng thái hệ thống.`;
      await this.zaloService.sendMessage(context.chatId, reply);
      return;
    }

    try {
      const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
      const isConnected = this.googleAuthService.isSharedAuthorized();

      const statusNote = isConnected
        ? '💡 Bạn ĐÃ kết nối Google dùng chung. Bấm link bên dưới nếu bạn muốn đổi sang tài khoản Gmail khác.'
        : '⚠️ Hệ thống CHƯA kết nối tài khoản Google dùng chung.';

      const reply =
        `🔐 KẾT NỐI TÀI KHOẢN GOOGLE HỆ THỐNG (DÙNG CHUNG)\n\n` +
        `${statusNote}\n\n` +
        `Nhấn vào link bên dưới để cấp quyền cho trợ lý:\n` +
        `👉 ${authUrl}\n\n` +
        `Sau khi chọn tài khoản và bấm "Cho phép", hệ thống sẽ kích hoạt kết nối Calendar, Tasks, Drive & Google Photos cho toàn bộ người dùng!`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to generate Google auth URL: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo link đăng nhập Google: ${(err as Error).message}`,
      );
    }
  }
}
