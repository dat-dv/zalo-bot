import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class LoginToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LOGIN;
  private readonly logger = new Logger(LoginToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
      const isConnected = this.googleAuthService.isAuthorized(context.senderId);

      const statusNote = isConnected
        ? '💡 (Hiện tại bạn ĐÃ kết nối Google. Nếu muốn đổi tài khoản, bạn chỉ cần liên kết lại tài khoản mới)'
        : '⚠️ (Hiện tại bạn CHƯA kết nối tài khoản Google)';

      const reply =
        `🔐 KẾT NỐI TÀI KHOẢN GOOGLE WORKSPACE\n\n` +
        `${statusNote}\n\n` +
        `Để trợ lý có thể quản lý Google Calendar (Lịch) & Google Tasks (Việc cần làm), bạn thực hiện:\n\n` +
        `1️⃣ Mở đường dẫn sau trên trình duyệt:\n` +
        `👉 ${authUrl}\n\n` +
        `2️⃣ Đăng nhập Gmail và bấm "Cho phép" (Allow).\n` +
        `3️⃣ Sau khi cấp quyền thành công, nếu cần bạn có thể gửi lại mã xác thực qua cú pháp:\n` +
        `/code <mã_xác_thực>`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to generate Google Auth URL: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo link đăng nhập Google: ${(err as Error).message}`,
      );
    }
  }
}
