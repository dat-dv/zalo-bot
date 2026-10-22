import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { AgentInput } from '../../types/agent-input.type';
import { UsersService } from '../../users/users.service';
import { ZcaService } from '../zca.service';
import { sendChatText, type ChatMessenger } from '../chat-messenger.util';

@Injectable()
export class GrantAccessGuard {
  private readonly logger = new Logger(GrantAccessGuard.name);

  constructor(
    private readonly usersService: UsersService,
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ChatMessenger,
  ) {}

  /**
   * Guard 2:
   * Kiểm tra xem user có quyền truy cập bot (isGrantAccess / Whitelist) hay không:
   * 1. Tự động lưu user vào DB nếu chưa có với cờ grantAccess = DENIED (chờ duyệt).
   * 2. Kênh cấp quyền riêng (`threadGrant`, từ `ThreadAccessService`) thì cho qua, cộng thêm vào quyền toàn cục.
   * 3. Kiểm tra quyền truy cập toàn cục (check Redis cache trước, DB sau).
   * 4. Nếu chưa được cấp quyền: REJECT (trả về false) và gửi tin nhắn kèm User ID cho user gửi Admin duyệt.
   */
  public async canActivate(
    input: AgentInput,
    options?: { threadGrant?: boolean },
  ): Promise<boolean> {
    const senderId = input.senderId;
    if (!senderId) {
      return false;
    }

    if (
      input.isBot ||
      (typeof this.usersService?.isAdmin === 'function' && this.usersService.isAdmin(senderId))
    ) {
      return true;
    }

    // 1. Lưu user vào DB với cờ grantAccess = DENIED nếu chưa có
    await this.usersService.registerPendingUser(senderId, input.displayName);

    // 2. Kênh (nhóm) đã cấp quyền cho người này: không cần quyền toàn cục
    if (options?.threadGrant) {
      return true;
    }

    // 3. Kiểm tra quyền truy cập toàn cục (check Redis cache whitelist)
    const isGranted = await this.usersService.isGrantAccess(senderId);

    if (isGranted) {
      return true;
    }

    // 4. Nếu chưa được cấp quyền: REJECT & gửi tin nhắn kèm User ID
    this.logger.warn(
      `[GRANT ACCESS GUARD] User ${senderId} (${input.displayName || 'Anonymous'}) blocked: grantAccess is denied.`,
    );

    const targetChatId = input.chatId || senderId;
    const rejectionMessage =
      `⛔ BẠN CHƯA ĐƯỢC CẤP QUYỀN TRUY CẬP\n\n` +
      `Trợ lý Zalo Bot hiện đang ở chế độ bảo mật nội bộ. Vui lòng gửi User ID bên dưới cho Quản trị viên (Admin) để được cấp quyền sử dụng:\n\n` +
      `🆔 User ID của bạn:\n${senderId}\n\n` +
      `💡 Sau khi Quản trị viên phê duyệt trên Dashboard, bạn có thể gửi lại tin nhắn để bắt đầu sử dụng nhé!`;

    await sendChatText(this.zcaService, targetChatId, rejectionMessage);

    return false;
  }
}
