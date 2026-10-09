import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class InviteToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.INVITE;
  private readonly logger = new Logger(InviteToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly usersService: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);

    if (!isAdmin) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⛔ Chỉ Quản trị viên (Admin) mới có quyền tạo mã mời tham gia trợ lý.',
      );
      return;
    }

    try {
      const invite = await this.usersService.createInvite(context.senderId);

      const reply =
        `🎟️ TẠO LINK MỜI THÀNH CÔNG (ADMIN)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Mã mời: ${invite.code}\n\n` +
        `Gửi lệnh sau cho bạn bè hoặc người thân để kích hoạt trợ lý:\n\n` +
        `/start ${invite.code}\n\n` +
        `⏰ Hạn sử dụng: 24 giờ kể từ bây giờ.\n` +
        `🔒 Mã này chỉ có giá trị sử dụng duy nhất một lần.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to create invite code: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo mã mời người dùng.',
      );
    }
  }
}
