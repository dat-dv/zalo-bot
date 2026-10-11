import { Injectable, Logger } from '@nestjs/common';
import { AgentInput } from '../types/agent-input.type';
import { UsersService } from '../../users/users.service';
import { ZaloService } from '../zalo.service';

@Injectable()
export class InitialAdminBootstrapGuard {
  private readonly logger = new Logger(InitialAdminBootstrapGuard.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly zaloService: ZaloService,
  ) {}

  /**
   * Guard 1:
   * Nếu hệ thống chưa có bất kỳ Admin hoặc user nào trong whitelist,
   * người đầu tiên chat với bot sẽ tự động được phong làm Admin tối cao.
   * Trả về true nếu đây là người đầu tiên và đã xử lý khởi tạo xong.
   */
  public async canActivate(input: AgentInput): Promise<boolean> {
    const senderId = input.senderId;
    if (!senderId) return false;

    const hasAnyAdminOrWhitelisted = await this.usersService.hasAnyAdminOrWhitelistedUser();

    if (!hasAnyAdminOrWhitelisted) {
      this.logger.log(`🎉 First user detected: ${senderId}. Promoting to system administrator!`);
      await this.usersService.bootstrapFirstAdmin(senderId, input.displayName);

      const targetChatId = input.chatId || senderId;
      const welcomeAdminMessage =
        `👑 CHÀO BẠN, BẠN LÀ QUẢN TRỊ VIÊN (ADMIN) HỆ THỐNG!\n\n` +
        `Bạn là người đầu tiên kết nối với trợ lý Zalo Bot, hệ thống đã tự động gán quyền Quản trị viên tối cao cho bạn.\n\n` +
        `✨ Quyền hạn của Quản trị viên:\n` +
        `• Toàn quyền sử dụng trợ lý và tất cả các tính năng ghi chép, quản lý tài chính, nhắc nhở.\n` +
        `• Bạn có thể thêm người khác hoặc phê duyệt cấp quyền cho họ thông qua mục "Người dùng" trên trang Dashboard quản trị.\n\n` +
        `💡 Giờ bạn có thể bắt đầu sử dụng bot, hoặc gõ /help để xem danh sách lệnh nhé!`;

      await this.zaloService.sendMessage(targetChatId, welcomeAdminMessage);
      return true;
    }

    return false;
  }
}
