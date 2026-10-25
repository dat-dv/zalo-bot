import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class WelcomeToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.WELCOME;
  private readonly logger = new Logger(WelcomeToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly googleAuthService?: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = Boolean(this.googleAuthService?.isAuthorized(context.senderId));
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));

    const googleStatus = isGoogleConnected
      ? 'Google: đã kết nối.'
      : 'Google: chưa kết nối. Gõ /login để kết nối.';

    const roleLine = isAdmin ? 'Bạn đang là admin.\n' : '';

    const welcomeMessage =
      `👋 Chào ${context.displayName || 'bạn'}, mình là trợ lý của bạn trên Zalo.\n` +
      `Mình lo lịch Google Calendar, việc cần làm, thu chi, hoá đơn, sổ nợ, cho vay, nhắc giờ và có dashboard web để xem lại.\n` +
      roleLine +
      `${googleStatus}\n\n` +
      `Cứ nhắn bình thường, ví dụ:\n` +
      `• "15 phút nữa nhắc anh tắt bếp"\n` +
      `• "Chiều mai 14h họp dự án với sếp"\n` +
      `• "Thêm việc chuẩn bị slide báo cáo"\n` +
      `• "Ăn trưa bún bò 45k" hoặc "Tiền lương 15tr"\n` +
      `• "Cho Nam vay 500k hẹn cuối tháng trả"\n` +
      `• "Hôm nay có lịch gì và đã tiêu bao nhiêu?"\n\n` +
      `Gõ /help để xem hết các lệnh.`;

    await this.zcaMessenger.sendMessage(context.chatId, welcomeMessage);
  }
}
