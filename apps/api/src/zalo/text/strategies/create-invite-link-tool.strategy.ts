import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class CreateInviteLinkToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_INVITE_LINK;
  private readonly logger = new Logger(CreateInviteLinkToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly usersService: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);

    if (!isAdmin) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⛔ Chỉ Quản trị viên (Admin) mới có quyền yêu cầu tạo mã mời.',
      );
      return;
    }

    try {
      const invite = await this.usersService.createInvite(context.senderId);

      const reply =
        `🎟️ ĐÃ TẠO MÃ MỜI THÀNH CÔNG (ADMIN)\n\n` +
        `Mã mời: ${invite.code}\n\n` +
        `Bạn hãy gửi cho bạn bè để họ nhắn lệnh này cho bot Zalo:\n` +
        `/start ${invite.code}\n\n` +
        `⏰ Mã có hiệu lực trong vòng 24 giờ và dùng được 1 lần duy nhất.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to create invite: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo link mời: ${(err as Error).message}`,
      );
    }
  }
}
