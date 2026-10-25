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
      const reply = `⛔ Chỉ admin mới đăng nhập được Zalo cá nhân cho bot. Gõ /status để xem trạng thái.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }

    try {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⏳ Đang tạo mã QR đăng nhập Zalo cá nhân...',
      );

      void this.zcaService.startQrLogin({
        onQrGenerated: (qrUrl, code) => {
          const reply =
            `🔐 Mã QR đăng nhập Zalo cá nhân\n` +
            `Mở link này trên trình duyệt hoặc điện thoại để quét:\n` +
            `${qrUrl}\n` +
            (code ? `Hoặc quét trực tiếp URL: ${code}\n` : '') +
            `Mã hết hạn sau 2 phút. Xác nhận trên điện thoại xong là bot bắt đầu nhận tin nhắn.`;

          void this.zcaMessenger.sendMessage(context.chatId, reply);
        },
        onScanned: (name) => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            `📱 ${name} đã quét mã. Bấm "Xác nhận đăng nhập" trong app Zalo trên điện thoại.`,
          );
        },
        onExpired: () => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            '⏰ Mã QR hết hạn, đang tạo mã mới...',
          );
        },
        onDeclined: () => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            '⚠️ Đăng nhập Zalo cá nhân bị từ chối trên thiết bị.',
          );
        },
        onSuccess: (ownId) => {
          const successMsg =
            `✅ Đã đăng nhập Zalo cá nhân, ID ${ownId}. Bot bắt đầu nhận tin nhắn và sự kiện nhóm.\n` +
            `Chọn người dùng và nhóm cần nghe trên dashboard.`;
          void this.zcaMessenger.sendMessage(context.chatId, successMsg);
        },
        onError: (errMsg) => {
          void this.zcaMessenger.sendMessage(
            context.chatId,
            `⚠️ Chưa đăng nhập được Zalo cá nhân: ${errMsg}`,
          );
        },
      });
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      this.logger.error(`Failed to initiate ZCA login: ${errMsg}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Không tạo được mã đăng nhập Zalo cá nhân: ${errMsg}`,
      );
    }
  }
}
