import { Injectable, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class HelpToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.HELP;

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const reply =
      `📖 Danh sách lệnh hỗ trợ\n` +
      `Cứ nhắn tiếng Việt bình thường, bot tự hiểu và làm.\n\n` +
      `Thu chi và hoá đơn:\n` +
      `• Ghi thu chi: "ăn trưa 45k", "tiền lương 15tr", "đổ xăng 50k qua thẻ tại Circle K"\n` +
      `• Xoá, huỷ giao dịch: "xoá giao dịch ăn trưa vừa ghi", "huỷ giao dịch gần nhất", "xoá giao dịch id <mã>"\n` +
      `• Báo cáo chi tiêu: "hôm nay chi bao nhiêu?", "tháng này tiêu hết bao nhiêu?", "báo cáo tài chính"\n\n` +
      `Sổ nợ và cho vay:\n` +
      `• Cho vay, đòi nợ: "cho Nam vay 200k hẹn mai trả", "Nam trả nợ 200k"\n` +
      `• Mượn nợ: "nợ anh Ba 100k tiền cà phê", "mượn mẹ 2tr"\n\n` +
      `Lịch Google Calendar:\n` +
      `• Tạo lịch hẹn: "mai 14h họp dự án tại phòng 3", "hẹn ăn tối thứ 6 lúc 19h tại Landmark 81"\n` +
      `• Xem lịch: "lịch hôm nay", "ngày mai có lịch gì không?", "xem lịch tuần này"\n` +
      `• Xoá lịch hẹn: "xoá lịch họp dự án chiều nay", "huỷ lịch ăn tối thứ 6"\n\n` +
      `Việc cần làm:\n` +
      `• Thêm việc: "thêm việc nộp báo cáo trước 17h", "cần mua sữa chua", "/task gửi hợp đồng"\n` +
      `• Xem việc: "danh sách việc cần làm", "còn việc gì chưa xong?", "/tasks"\n` +
      `• Đánh dấu xong: "đã xong việc nộp báo cáo", "hoàn thành task mua sữa"\n\n` +
      `Hẹn giờ nhắc:\n` +
      `• "15 phút nữa nhắc anh tắt bếp", "mai 9h nhắc gọi khách hàng", "nhắc tôi 3h chiều đón con"\n\n` +
      `Duyệt yêu cầu (thẻ có mã 3 số):\n` +
      `• Thả tim hoặc gõ "yes <mã>" để duyệt, thả phẫn nộ hoặc gõ "cancel <mã>" để huỷ\n` +
      `• "edit <mã> <nội dung>" để sửa, ví dụ "edit 629 đổi số tiền thành 60k"\n` +
      `• "yes all" / "cancel all" - duyệt hoặc huỷ hết yêu cầu đang chờ của bạn\n\n` +
      `Google Drive và Photos:\n` +
      `• "ảnh lưu ở đâu?", "cho link xem ảnh", "link drive của nhóm", "link hoá đơn"\n` +
      `• /drive (hoặc /storage, /kho, /album) - mở thư mục Drive và Photos của nhóm\n` +
      `• /share <email> (hoặc @bot share <email>) - cấp quyền xem Drive cho thành viên\n\n` +
      `Lệnh nhanh:\n` +
      `• /gioithieu (hoặc "giới thiệu") - giới thiệu bot\n` +
      `• /today - lịch hẹn và việc cần làm hôm nay\n` +
      `• /week - lịch hẹn và việc 7 ngày tới\n` +
      `• /tasks - việc cần làm\n` +
      `• /finance (hoặc /thuchi) - thu chi hôm nay\n` +
      `• /debts (hoặc /congo) - các khoản nợ và cho vay\n` +
      `• /reminders - lời nhắc sắp tới\n` +
      `• /dashboard - mở dashboard web xem biểu đồ, phân tích\n` +
      `• /status - tài khoản và kết nối Google\n` +
      `• /reset (hoặc /clear) - làm mới hội thoại với bot\n` +
      `• /ping - kiểm tra bot còn chạy không\n\n` +
      `Cho admin:\n` +
      `• /login (hoặc /auth) - đăng nhập Google dùng chung cho Calendar, Drive, Photos\n` +
      `• /zalo-login (hoặc /zca-login, /zlogin) - đăng nhập Zalo cá nhân (ZCA) bằng mã QR\n` +
      `• /zalo-logout (hoặc /zca-logout, /zlogout) - đăng xuất, ngắt kết nối Zalo cá nhân (ZCA)\n` +
      `• /users - danh sách người dùng và trạng thái Google\n` +
      `• /ban <id> - thu hồi quyền và huỷ token Google của người dùng`;

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
