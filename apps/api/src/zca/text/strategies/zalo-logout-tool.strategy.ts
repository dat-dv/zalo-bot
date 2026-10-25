import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { ZcaService } from '../../zca.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class ZaloLogoutToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ZALO_LOGOUT;
  private readonly logger = new Logger(ZaloLogoutToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly zcaService: ZcaService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    if (!isAdmin) {
      const reply = `⛔ Chỉ admin mới đăng xuất được Zalo cá nhân của bot. Gõ /status để xem trạng thái.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }

    if (!this.zcaService.isLoggedIn()) {
      const reply = `Zalo cá nhân của bot đang chưa đăng nhập. Gõ /zalo-login hoặc /zca-login để kết nối.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }

    try {
      await this.zcaService.logout();
      const reply =
        `✅ Đã đăng xuất Zalo cá nhân. Bot ngừng nhận tin nhắn và sự kiện nhóm, phiên đăng nhập và cookie đã xoá khỏi hệ thống.\n` +
        `Gõ /zalo-login khi cần kết nối lại.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      this.logger.error(`Failed to logout ZCA: ${errMsg}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa đăng xuất được Zalo cá nhân: ${errMsg}`,
      );
    }
  }
}
