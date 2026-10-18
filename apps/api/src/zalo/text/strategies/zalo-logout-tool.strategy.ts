import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { ZcaService } from '../../../zca/zca.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class ZaloLogoutToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ZALO_LOGOUT;
  private readonly logger = new Logger(ZaloLogoutToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly zcaService: ZcaService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    if (!isAdmin) {
      const reply =
        `⛔ QUYỀN TRUY CẬP BỊ GIỚI HẠN\n\n` +
        `Chỉ Quản trị viên (Admin) mới có quyền đăng xuất và ngắt kết nối tài khoản Zalo cá nhân (ZCA).\n\n` +
        `💡 Bạn có thể gõ /status để kiểm tra trạng thái hoạt động của hệ thống.`;
      await this.zaloService.sendMessage(context.chatId, reply);
      return;
    }

    if (!this.zcaService.isLoggedIn()) {
      const reply =
        `ℹ️ TRẠNG THÁI ZCA HIỆN TẠI\n\n` +
        `Tài khoản Zalo cá nhân (ZCA) hiện đang ở trạng thái CHƯA ĐĂNG NHẬP.\n\n` +
        `💡 Để kết nối tài khoản, bạn có thể gõ lệnh /zalo-login (hoặc /zca-login).`;
      await this.zaloService.sendMessage(context.chatId, reply);
      return;
    }

    try {
      await this.zcaService.logout();
      const reply =
        `✅ ĐÃ ĐĂNG XUẤT TÀI KHOẢN ZCA THÀNH CÔNG!\n\n` +
        `• Bot đã dừng lắng nghe tin nhắn cá nhân & sự kiện nhóm.\n` +
        `• Phiên làm việc và cookies đã được xóa sạch an toàn khỏi hệ thống.\n\n` +
        `💡 Để kết nối lại tài khoản Zalo cá nhân, bạn có thể gõ /zalo-login bất cứ lúc nào.`;
      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      this.logger.error(`Failed to logout ZCA: ${errMsg}`);
      await this.zaloService.sendMessage(context.chatId, `⚠️ Không thể đăng xuất ZCA: ${errMsg}`);
    }
  }
}
