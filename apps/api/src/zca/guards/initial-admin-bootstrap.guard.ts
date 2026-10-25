import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { AgentInput } from '../../types/agent-input.type';
import { UsersService } from '../../users/users.service';
import { ZcaService } from '../zca.service';
import { sendChatText, type ChatMessenger } from '../chat-messenger.util';

@Injectable()
export class InitialAdminBootstrapGuard {
  private readonly logger = new Logger(InitialAdminBootstrapGuard.name);

  constructor(
    private readonly usersService: UsersService,
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ChatMessenger,
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
        `👑 Bạn là người đầu tiên nhắn bot nên đã được đặt làm admin.\n` +
        `Admin dùng được mọi tính năng: ghi chép, tài chính, nhắc việc.\n` +
        `Thêm hoặc duyệt quyền cho người khác ở trang "Zalo & Người dùng" trên dashboard.\n` +
        `Gõ /help để xem các lệnh.`;

      await sendChatText(this.zcaService, targetChatId, welcomeAdminMessage);
      return true;
    }

    return false;
  }
}
