import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class StatusToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.STATUS;

  constructor(
    private readonly zaloService: ZaloService,
    private readonly usersService: UsersService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);
    const isGoogleConnected = this.googleAuthService.isSharedAuthorized();
    const sharedEmail = isGoogleConnected
      ? await this.googleAuthService.getSharedAccountEmail()
      : null;

    const roleText = isAdmin ? '👑 Quản trị viên (Admin)' : '👤 Thành viên (Member)';

    let googleSection = '';
    if (isGoogleConnected) {
      const emailLine = sharedEmail ? `\n• Tài khoản: ${sharedEmail}` : '';
      googleSection =
        `🌐 GOOGLE WORKSPACE HỆ THỐNG:\n` +
        `• Trạng thái: ✅ Đã kết nối (Dùng chung)${emailLine}\n` +
        `• Dịch vụ sẵn sàng:\n` +
        `  - 📅 Google Calendar (Lịch trình & cuộc họp)\n` +
        `  - 📝 Google Tasks (Danh sách việc cần làm)\n` +
        `  - 📁 Google Drive (Lưu trữ: zalobot/bills, images, videos)\n` +
        `  - 📸 Google Photos (Album ZaloBot)`;
    } else {
      if (isAdmin) {
        googleSection =
          `🌐 GOOGLE WORKSPACE HỆ THỐNG:\n` +
          `• Trạng thái: ❌ Chưa kết nối\n` +
          `👉 Bạn là Quản trị viên, vui lòng gõ /login để kết nối tài khoản Google dùng chung cho hệ thống.`;
      } else {
        googleSection =
          `🌐 GOOGLE WORKSPACE HỆ THỐNG:\n` +
          `• Trạng thái: ❌ Chưa kết nối\n` +
          `💡 Vui lòng nhờ Quản trị viên gõ /login để kích hoạt Google Workspace cho toàn bộ người dùng.`;
      }
    }

    const reply =
      `📊 TRẠNG THÁI TÀI KHOẢN TRỢ LÝ\n\n` +
      `• Tên hiển thị: ${context.displayName || 'Người dùng'}\n` +
      `• Zalo ID: ${context.senderId}\n` +
      `• Vai trò: ${roleText}\n\n` +
      `${googleSection}\n\n` +
      `💡 Gõ /help để xem toàn bộ danh sách lệnh hỗ trợ.`;

    await this.zaloService.sendMessage(context.chatId, reply);
  }
}
