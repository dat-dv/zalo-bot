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
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    const roleText = isAdmin ? '👑 Quản trị viên (Admin)' : '👤 Thành viên (Member)';
    const googleStatus = isGoogleConnected
      ? '✅ Đã kết nối (Calendar & Tasks sẵn sàng)'
      : '❌ Chưa kết nối (gõ /login để liên kết)';

    const reply =
      `📊 TRẠNG THÁI TÀI KHOẢN TRỢ LÝ\n\n` +
      `• Tên hiển thị: ${context.displayName || 'Người dùng'}\n` +
      `• Zalo ID: ${context.senderId}\n` +
      `• Vai trò: ${roleText}\n` +
      `• Google Workspace: ${googleStatus}\n\n` +
      `💡 Gõ /help để xem toàn bộ danh sách lệnh hỗ trợ.`;

    await this.zaloService.sendMessage(context.chatId, reply);
  }
}
