import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { AgentInput } from '../../types/agent-input.type';
import { UsersService } from '../../users/users.service';
import { ZcaService } from '../zca.service';

@Injectable()
export class InitialAdminBootstrapGuard {
  private readonly logger = new Logger(InitialAdminBootstrapGuard.name);

  constructor(
    private readonly usersService: UsersService,
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?:
      | ZcaService
      | {
          sendMessage?: (a: unknown, b?: unknown) => Promise<unknown>;
          sendMessageToChat?: (chatId: string | number, text: string) => Promise<unknown>;
        },
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

      if (this.zcaService) {
        if (
          'sendMessageToChat' in this.zcaService &&
          typeof this.zcaService.sendMessageToChat === 'function'
        ) {
          await this.zcaService.sendMessageToChat(targetChatId, welcomeAdminMessage);
        } else if (typeof (this.zcaService as any).isLoggedIn === 'function') {
          await this.zcaService.sendMessage(welcomeAdminMessage, targetChatId);
        } else if (typeof this.zcaService.sendMessage === 'function') {
          await (this.zcaService as any).sendMessage(targetChatId, welcomeAdminMessage);
        }
      }
      return true;
    }

    return false;
  }
}
