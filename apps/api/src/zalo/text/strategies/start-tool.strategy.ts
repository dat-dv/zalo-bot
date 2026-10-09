import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class StartToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.START;
  private readonly logger = new Logger(StartToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly googleAuthService?: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const rawText = context.text?.trim() || '';

    // 1. Handle invite code: e.g. /start invite_xyz or just invite_xyz
    if (rawText.includes('invite_')) {
      const match = rawText.match(/invite_[a-zA-Z0-9]+/);
      const inviteCode = match ? match[0] : '';

      if (inviteCode && this.usersService) {
        const result = await this.usersService.consumeInvite(inviteCode, {
          id: context.senderId,
          firstName: context.displayName,
        });

        if (!result.success) {
          await this.zaloService.sendMessage(
            context.chatId,
            `⚠️ Kích hoạt thất bại: ${result.message}`,
          );
          return;
        }

        let authUrl = '';
        try {
          authUrl = this.googleAuthService?.generateAuthUrl(context.senderId) || '';
        } catch {
          // ignore
        }

        const authGuide = authUrl
          ? `👉 BƯỚC TIẾP THEO: KẾT NỐI GOOGLE CALENDAR & TASKS\n` +
            `Mở link sau trên trình duyệt để cấp quyền:\n` +
            `🔗 ${authUrl}\n\n` +
            `Sau khi bấm "Cho phép", tài khoản của bạn sẽ sẵn sàng sử dụng ngay!`
          : `Gõ /login để nhận link liên kết tài khoản Google nhé!`;

        const welcomeActivated =
          `🎉 CHÚC MỪNG ${context.displayName?.toUpperCase() || 'BẠN'} ĐÃ KÍCH HOẠT THÀNH CÔNG!\n\n` +
          `Bạn đã được cấp quyền sử dụng trợ lý cá nhân Zalo độc lập 100%.\n\n` +
          `${authGuide}`;

        await this.zaloService.sendMessage(context.chatId, welcomeActivated);
        return;
      }
    }

    // 2. Normal /start
    const isGoogleConnected = Boolean(this.googleAuthService?.isAuthorized(context.senderId));
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    const googleStatus = isGoogleConnected
      ? '✅ Tài khoản Google: Đã kết nối (Lịch & Việc sẵn sàng)'
      : '⚠️ Tài khoản Google: Chưa kết nối (Gõ /login để liên kết)';

    const roleBadge = isAdmin ? ' [👑 Admin]' : '';

    const welcomeMessage =
      `👋 Chào ${context.displayName || 'bạn'}${roleBadge}!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Tôi là Trợ lý AI cá nhân toàn năng trên Zalo của bạn:\n` +
      `📅 Google Calendar & 📝 Google Tasks\n` +
      `💰 Quản lý Thu–Chi & 🧾 Hóa đơn\n` +
      `💳 Sổ nợ & Cho vay & ⏰ Nhắc việc hẹn giờ\n` +
      `📊 Web Dashboard trực quan\n\n` +
      `${googleStatus}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Bạn có thể nhắn tin tự nhiên bất cứ lúc nào:\n` +
      `• ⏰ "15 phút nữa nhắc anh tắt bếp"\n` +
      `• 📅 "Chiều mai 14h họp dự án với sếp"\n` +
      `• 📝 "Thêm việc chuẩn bị slide báo cáo"\n` +
      `• 💰 "Ăn trưa bún bò 45k" hoặc "Tiền lương 15tr"\n` +
      `• 💳 "Cho Nam vay 500k hẹn cuối tháng trả"\n` +
      `• 📊 "Hôm nay có lịch gì và đã tiêu bao nhiêu?"\n\n` +
      `Gõ /help để xem toàn bộ danh sách lệnh hỗ trợ.`;

    await this.zaloService.sendMessage(context.chatId, welcomeMessage);
  }
}
