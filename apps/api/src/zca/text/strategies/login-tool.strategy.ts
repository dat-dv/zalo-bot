import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class LoginToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LOGIN;
  private readonly logger = new Logger(LoginToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly googleAuthService: GoogleAuthService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    if (!isAdmin) {
      const reply =
        `⛔ QUYỀN TRUY CẬP BỊ GIỚI HẠN\n\n` +
        `Chỉ Quản trị viên (Admin) mới có quyền kết nối tài khoản Google cho hệ thống.\n\n` +
        `Tài khoản Google sau khi Quản trị viên kết nối sẽ được kích hoạt dùng chung cho toàn bộ thành viên (Calendar, Tasks, Google Drive & Google Photos).\n\n` +
        `💡 Vui lòng liên hệ Quản trị viên để kết nối tài khoản. Bạn có thể gõ /status để kiểm tra trạng thái hệ thống.`;
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }

    try {
      const authUrl = this.googleAuthService.generateAuthUrl(context.senderId);
      const isConnected = this.googleAuthService.isSharedAuthorized();
      const hasStorage =
        typeof this.googleAuthService.hasStorageScopes === 'function'
          ? this.googleAuthService.hasStorageScopes()
          : true;

      let statusNote = '';
      if (!isConnected) {
        statusNote = '⚠️ (Hệ thống CHƯA kết nối tài khoản Google dùng chung)';
      } else if (!hasStorage) {
        statusNote =
          '⚠️ TÀI KHOẢN GOOGLE HIỆN TẠI THIẾU QUYỀN LƯU TRỮ DRIVE & PHOTOS!\n' +
          '(Tài khoản đã kết nối Lịch & Tasks nhưng CHƯA có quyền lưu ảnh/video lên Drive và Photos. Vui lòng cấp quyền bổ sung)';
      } else {
        statusNote =
          '💡 (Hệ thống ĐÃ kết nối Google dùng chung đầy đủ quyền. Bạn có thể cấp quyền lại nếu muốn đổi sang tài khoản Gmail mới)';
      }

      const reply =
        `🔐 KẾT NỐI TÀI KHOẢN GOOGLE HỆ THỐNG (DÙNG CHUNG)\n\n` +
        `${statusNote}\n\n` +
        `Tài khoản này sẽ được dùng chung cho toàn bộ thành viên trong bot để:\n` +
        `• 📅 Quản lý Lịch trình (Google Calendar)\n` +
        `• 📝 Việc cần làm (Google Tasks)\n` +
        `• 📁 Lưu trữ hóa đơn, ảnh & video (Google Drive: zalobot/bills, images, videos)\n` +
        `• 📸 Tự động tạo Album & đẩy ảnh (Google Photos: ZaloBot)\n\n` +
        `Các bước thực hiện:\n` +
        `1️⃣ Mở đường dẫn sau trên trình duyệt:\n` +
        `👉 ${authUrl}\n\n` +
        `2️⃣ Đăng nhập Gmail và bấm "Cho phép" (Allow) các quyền.\n\n` +
        `Sau khi cấp quyền thành công, hệ thống sẽ tự động kích hoạt kết nối và gửi thông báo xác nhận tới bạn!`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to generate Google Auth URL: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo link đăng nhập Google: ${(err as Error).message}`,
      );
    }
  }
}
