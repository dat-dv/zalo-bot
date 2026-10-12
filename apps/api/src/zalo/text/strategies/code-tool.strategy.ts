import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';

export function extractAuthCode(input: string): string {
  let cleaned = input.trim();
  if (cleaned.includes('code=')) {
    try {
      const urlToParse = cleaned.startsWith('http') ? cleaned : `http://localhost/${cleaned}`;
      const parsed = new URL(urlToParse);
      const code = parsed.searchParams.get('code');
      if (code) return code.trim();
    } catch {
      const match = cleaned.match(/code=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]).trim();
    }
  }
  // Remove command prefix e.g. /code
  cleaned = cleaned.replace(/^\/code\s*/i, '').trim();
  return cleaned;
}

@Injectable()
export class CodeToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CODE;
  private readonly logger = new Logger(CodeToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));
    if (!isAdmin) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⛔ Chỉ Quản trị viên (Admin) mới có quyền xác thực kết nối tài khoản Google cho hệ thống.',
      );
      return;
    }

    const rawInput = context.text || '';
    const code = extractAuthCode(rawInput);

    if (!code) {
      await this.zaloService.sendMessage(
        context.chatId,
        'ℹ️ Vui lòng cung cấp mã xác thực sau lệnh /code (ví dụ: /code 4/0AY0e-g...). Hoặc gõ /login để nhận link đăng nhập mới.',
      );
      return;
    }

    try {
      await this.googleAuthService.exchangeCodeForTokens(context.senderId, code);
      const email = await this.googleAuthService.getSharedAccountEmail();
      const emailText = email ? ` (${email})` : '';

      const reply =
        `🎉 KẾT NỐI GOOGLE HỆ THỐNG THÀNH CÔNG!\n\n` +
        `Tài khoản Google${emailText} đã được kích hoạt làm tài khoản dùng chung cho toàn bộ thành viên.\n\n` +
        `Các dịch vụ sẵn sàng hoạt động:\n` +
        `• 📅 Google Calendar (Lịch trình & cuộc họp)\n` +
        `• 📝 Google Tasks (Danh sách việc cần làm)\n` +
        `• 📁 Google Drive (Lưu trữ hóa đơn: zalobot/bills, hình ảnh: zalobot/images, video: zalobot/videos)\n` +
        `• 📸 Google Photos (Album ZaloBot tự động phân loại)\n\n` +
        `Mọi thành viên trong bot hiện tại đã có thể sử dụng các tính năng này!`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(
        `Code exchange failed for user ${context.senderId}: ${(err as Error).message}`,
      );
      await this.zaloService.sendMessage(
        context.chatId,
        `❌ Xác thực thất bại: Mã xác thực không hợp lệ hoặc đã hết hạn.\n\nVui lòng gõ /login để lấy link đăng nhập mới.`,
      );
    }
  }
}
