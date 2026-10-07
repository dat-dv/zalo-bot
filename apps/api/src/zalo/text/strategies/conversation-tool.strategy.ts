import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class ConversationToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CONVERSATION;
  private readonly logger = new Logger(ConversationToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const allowedIds = this.configService.get<string[]>('zalo.allowedUserIds') || [];
    if (allowedIds.length > 0 && !this.usersService.isAllowed(context.senderId)) {
      this.logger.warn(`Unauthorized Zalo user message attempt from ${context.senderId}`);
      await this.zaloService.sendMessage(
        context.chatId,
        'Xin lỗi, tài khoản của bạn chưa được cấp quyền sử dụng trợ lý này.',
      );
      return;
    }

    const cooldown = this.usersService.checkCooldown(context.senderId);
    if (!cooldown.allowed) {
      await this.zaloService.sendMessage(
        context.chatId,
        cooldown.reason || 'Vui lòng gửi chậm lại.',
      );
      return;
    }

    await this.usersService.upsertUser(context.senderId);

    const messageText =
      context.aiReplyText ||
      `Đã nhận tin nhắn: "${context.text}". Gõ /help để xem danh sách các lệnh hỗ trợ.`;

    await this.zaloService.sendMessage(context.chatId, messageText);
  }
}
