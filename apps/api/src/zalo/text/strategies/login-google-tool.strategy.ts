import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class LoginGoogleToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LOGIN_GOOGLE;
  private readonly logger = new Logger(LoginGoogleToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
      const isConnected = this.googleAuthService.isAuthorized(context.senderId);

      const statusNote = isConnected
        ? '💡 Bạn ĐÃ kết nối Google. Bấm link bên dưới nếu bạn muốn đổi sang tài khoản Gmail khác.'
        : '⚠️ Bạn CHƯA kết nối tài khoản Google.';

      const reply =
        `🔐 KẾT NỐI GOOGLE CALENDAR & TASKS\n\n` +
        `${statusNote}\n\n` +
        `Nhấn vào link bên dưới để cấp quyền cho trợ lý:\n` +
        `👉 ${authUrl}\n\n` +
        `Sau khi chọn tài khoản và bấm "Cho phép", hệ thống sẽ kích hoạt kết nối cho bạn ngay lập tức!`;

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
