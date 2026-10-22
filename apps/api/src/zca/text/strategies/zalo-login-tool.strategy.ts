import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { ZcaService } from '../../zca.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class ZaloLoginToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ZALO_LOGIN;
  private readonly logger = new Logger(ZaloLoginToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly zcaService: ZcaService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    if (!isAdmin) {
      const reply =
        `⛔ QUYỀN TRUY CẬP BỊ GIỚI HẠN\n\n` +
        `Chỉ Quản trị viên (Admin) mới có quyền khởi tạo đăng nhập Zalo cá nhân (ZCA).\n\n` +
        `💡 Vui lòng liên hệ Quản trị viên nếu cần kết nối tài khoản. Bạn có thể gõ /status để kiểm tra trạng thái hệ thống.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }

    try {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⏳ Đang khởi tạo mã QR đăng nhập Zalo cá nhân, vui lòng chờ trong giây lát...',
      );

      void this.zcaService.startQrLogin({
        onQrGenerated: (qrUrl, code) => {
          const reply =
            `🔐 MÃ QR ĐĂNG NHẬP ZALO CÁ NHÂN (ZCA)\n\n` +
            `Vui lòng mở liên kết sau trên trình duyệt hoặc điện thoại để quét mã QR:\n` +
            `👉 Xem ảnh mã QR: ${qrUrl}\n\n` +
            (code ? `Hoặc quét trực tiếp URL: ${code}\n\n` : '') +
            `⏳ Mã có hiệu lực trong 2 phút. Sau khi bạn xác nhận trên điện thoại, bot sẽ tự động bắt đầu lắng nghe tin nhắn!`;

          void this.zcaMessenger.sendMessage(context.chatId, reply);
        },
        onScanned: (name) => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            `📱 Đã quét mã QR bởi "${name}". Vui lòng bấm "Xác nhận đăng nhập" trên ứng dụng Zalo điện thoại của bạn.`,
          );
        },
        onExpired: () => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            '⏰ Mã QR đã hết hạn. Hệ thống đang tự động tạo lại mã mới...',
          );
        },
        onDeclined: () => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            '❌ Yêu cầu đăng nhập Zalo cá nhân đã bị từ chối trên thiết bị.',
          );
        },
        onSuccess: (ownId) => {
          const successMsg =
            `✅ ĐĂNG NHẬP ZALO CÁ NHÂN THÀNH CÔNG!\n\n` +
            `• ID tài khoản kết nối: ${ownId}\n` +
            `• Trạng thái: Đã bắt đầu lắng nghe tin nhắn & sự kiện nhóm.\n\n` +
            `💡 Bạn có thể vào Web Dashboard để cấu hình danh sách ID người dùng / nhóm cần lắng nghe.`;
          void this.zcaMessenger.sendMessage(context.chatId, successMsg);
        },
        onError: (errMsg) => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            `⚠️ Đăng nhập Zalo cá nhân thất bại: ${errMsg}`,
          );
        },
      });
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      this.logger.error(`Failed to initiate ZCA login: ${errMsg}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Không thể khởi tạo đăng nhập ZCA: ${errMsg}`,
      );
    }
  }
}
