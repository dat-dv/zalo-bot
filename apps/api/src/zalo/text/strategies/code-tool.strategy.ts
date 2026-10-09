import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

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
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
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

      const reply =
        `🎉 KẾT NỐI GOOGLE WORKSPACE THÀNH CÔNG!\n\n` +
        `Tài khoản Google Calendar & Google Tasks của bạn đã sẵn sàng hoạt động 100% độc lập.\n\n` +
        `Bạn có thể trải nghiệm các tính năng ngay:\n` +
        `• 📅 "Mai 14h họp dự án"\n` +
        `• 📝 "Thêm việc nộp báo cáo trước 17h"\n` +
        `• 📋 /today (Xem lịch trình hôm nay)\n` +
        `• 📋 /week (Xem lịch trình 7 ngày tới)`;

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
