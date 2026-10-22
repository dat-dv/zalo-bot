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
    const reply =
      `📖 HƯỚNG DẪN SỬ DỤNG TRỢ LÝ ZALO - Danh sách lệnh hỗ trợ:\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🤖 CÁC TÍNH NĂNG AI THÔNG MINH (TOOLCALLS HỮU ÍCH):\n` +
      `Bạn chỉ cần nhắn tin tiếng Việt tự nhiên, AI sẽ tự động phân tích và thực hiện:\n\n` +
      `💰 1. Quản lý Thu - Chi & Hóa đơn:\n` +
      `• Ghi nhận thu chi: "ăn trưa 45k", "tiền lương 15tr", "đổ xăng 50k qua thẻ tại Circle K"\n` +
      `• Xóa / Hủy giao dịch: "xóa giao dịch ăn trưa vừa ghi", "hủy giao dịch gần nhất", "xóa giao dịch id <mã>"\n` +
      `• Báo cáo chi tiêu: "hôm nay chi bao nhiêu?", "tháng này tiêu hết bao nhiêu?", "báo cáo tài chính"\n\n` +
      `💳 2. Quản lý Sổ nợ & Cho vay:\n` +
      `• Cho vay / Đòi nợ: "cho Nam vay 200k hẹn mai trả", "Nam trả nợ 200k"\n` +
      `• Mượn nợ: "nợ anh Ba 100k tiền cà phê", "mượn mẹ 2tr"\n\n` +
      `📅 3. Lịch Google Calendar:\n` +
      `• Tạo lịch hẹn: "mai 14h họp dự án tại phòng 3", "hẹn ăn tối thứ 6 lúc 19h tại Landmark 81"\n` +
      `• Tra cứu lịch: "lịch hôm nay", "ngày mai có lịch gì không?", "xem lịch tuần này"\n` +
      `• Xóa lịch hẹn: "xóa lịch họp dự án chiều nay", "hủy lịch ăn tối thứ 6"\n\n` +
      `📝 4. Việc cần làm:\n` +
      `• Thêm việc mới: "thêm việc nộp báo cáo trước 17h", "cần mua sữa chua", "/task gửi hợp đồng"\n` +
      `• Tra cứu việc: "danh sách việc cần làm", "còn việc gì chưa xong?", "/tasks"\n` +
      `• Đánh dấu xong: "đã xong việc nộp báo cáo", "hoàn thành task mua sữa"\n\n` +
      `⏰ 5. Hẹn giờ nhắc việc (Reminders):\n` +
      `• "15 phút nữa nhắc anh tắt bếp", "mai 9h nhắc gọi khách hàng", "nhắc tôi 3h chiều đón con"\n\n` +
      `📁 6. Kho lưu trữ Google Drive & Photos:\n` +
      `• "ảnh lưu ở đâu?", "cho link xem ảnh", "link drive của nhóm", "link hóa đơn"\n` +
      `• /drive (hoặc /storage, /kho, /album) - Mở trực tiếp thư mục Drive & Photos của channel\n` +
      `• /share <email> (hoặc @bot share <email>) - Cấp quyền truy cập Drive cho thành viên\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ LỆNH NHANH (FAST-PATH SHORTCUTS):\n` +
      `• /today - Lịch hẹn & việc cần làm hôm nay\n` +
      `• /week - Kế hoạch lịch trình & công việc 7 ngày tới\n` +
      `• /tasks - Danh sách việc cần làm\n` +
      `• /finance (hoặc /thuchi) - Báo cáo thu chi hôm nay\n` +
      `• /debts (hoặc /congo) - Danh sách các khoản nợ & cho vay\n` +
      `• /reminders - Danh sách lời nhắc hẹn giờ sắp tới\n` +
      `• /dashboard - Mở Web Dashboard trực quan (Biểu đồ, phân tích)\n` +
      `• /status - Xem trạng thái tài khoản & kết nối Google\n` +
      `• /reset (hoặc /clear) - Làm mới phiên hội thoại AI\n` +
      `• /ping - Kiểm tra kết nối bot\n\n` +
      `👑 DÀNH CHO QUẢN TRỊ VIÊN (ADMIN):\n` +
      `• /login (hoặc /auth) - Đăng nhập tài khoản Google dùng chung (Calendar, Tasks, Drive, Photos)\n` +
      `• /zalo-login (hoặc /zca-login, /zlogin) - Khởi tạo đăng nhập Zalo cá nhân (ZCA) bằng mã QR\n` +
      `• /zalo-logout (hoặc /zca-logout, /zlogout) - Đăng xuất & ngắt kết nối Zalo cá nhân (ZCA)\n` +
      `• /users - Xem danh sách người dùng & trạng thái Google\n` +
      `• /ban <id> - Thu hồi quyền & hủy token Google của người dùng\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Mẹo: Bạn có thể nhắn tin bằng tiếng Việt tự nhiên bất cứ lúc nào! Trợ lý AI sẽ tự động phân tích và kích hoạt công cụ phù hợp.`;

    await this.zaloService.sendMessage(context.chatId, reply);
  }
}
