import { Injectable, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class HelpToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.HELP;

  constructor(
    private readonly zaloService: ZaloService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    const adminCommands = isAdmin
      ? `\n👑 LỆNH DÀNH CHO QUẢN TRỊ VIÊN:\n` +
        `• /users - Xem danh sách người dùng & trạng thái Google\n` +
        `• /ban <id> - Thu hồi quyền & hủy token Google của người dùng\n`
      : '';

    const reply =
      `📖 HƯỚNG DẪN SỬ DỤNG TRỢ LÝ ZALO - Danh sách lệnh hỗ trợ:\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ KẾT NỐI TÀI KHOẢN GOOGLE:\n` +
      `• /login hoặc /auth - Lấy link đăng nhập Google Calendar & Tasks\n` +
      `• /code <mã> - Xác thực mã sau khi cấp quyền Google\n` +
      `• /status - Xem trạng thái tài khoản & kết nối Google\n\n` +
      `2️⃣ LỊCH TRÌNH & CÔNG VIỆC:\n` +
      `• /today - Tổng hợp lịch hẹn & việc cần làm hôm nay\n` +
      `• /week - Kế hoạch lịch trình & công việc 7 ngày tới\n` +
      `• /tasks - Danh sách việc cần làm (Google Tasks)\n` +
      `• /task <nội dung> - Thêm việc cần làm nhanh\n\n` +
      `3️⃣ TÀI CHÍNH & CÔNG NỢ:\n` +
      `• /finance hoặc /thuchi - Báo cáo thu chi hôm nay\n` +
      `• /debts hoặc /congo - Danh sách các khoản nợ & cho vay\n` +
      `• /dashboard - Mở Web Dashboard trực quan (Biểu đồ, phân tích)\n\n` +
      `4️⃣ NHẮC VIỆC & HỆ THỐNG:\n` +
      `• /reminders - Danh sách lời nhắc hẹn giờ sắp tới\n` +
      `• /ping - Kiểm tra kết nối bot\n` +
      `• /echo <nội dung> - Bot lặp lại nội dung\n` +
      `• /reset hoặc /clear - Làm mới phiên hội thoại` +
      adminCommands +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Mẹo: Bạn có thể nhắn tin bằng tiếng Việt tự nhiên bất cứ lúc nào! Trợ lý AI sẽ tự động phân tích và ghi nhận cho bạn.`;

    await this.zaloService.sendMessage(context.chatId, reply);
  }
}
