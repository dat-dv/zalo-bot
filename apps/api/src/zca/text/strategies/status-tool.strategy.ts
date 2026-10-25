import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class StatusToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.STATUS;

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly usersService: UsersService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);
    const isGoogleConnected = this.googleAuthService.isSharedAuthorized();
    const sharedEmail = isGoogleConnected
      ? await this.googleAuthService.getSharedAccountEmail()
      : null;

    const roleText = isAdmin ? 'admin' : 'thành viên';

    let googleSection = '';
    if (isGoogleConnected) {
      const account = sharedEmail ? ` bằng ${sharedEmail}` : '';
      googleSection =
        `Google: đã kết nối${account}, dùng chung cho cả hệ thống.\n` +
        `Dùng được Google Calendar, Google Drive (thư mục zalobot/bills, images, videos) và Google Photos (album ZaloBot).`;
    } else if (isAdmin) {
      googleSection =
        'Google: chưa kết nối. Bạn là admin, gõ /login để kết nối tài khoản Google dùng chung.';
    } else {
      googleSection = 'Google: chưa kết nối. Nhờ admin gõ /login để bật Google cho mọi người.';
    }

    const reply =
      `Tên: ${context.displayName || 'Người dùng'}\n` +
      `Zalo ID: ${context.senderId}\n` +
      `Vai trò: ${roleText}\n` +
      googleSection;

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
