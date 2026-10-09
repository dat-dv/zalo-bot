import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';

@Injectable()
export class ConversationToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CONVERSATION;
  private readonly logger = new Logger(ConversationToolStrategy.name);

  constructor(private readonly zaloService: ZaloService) {}

  public async execute(context: TextToolContext): Promise<void> {
    const messageText =
      context.aiReplyText ||
      `Đã nhận tin nhắn: "${context.text}". Gõ /help để xem danh sách các lệnh hỗ trợ.`;

    await this.zaloService.sendMessage(context.chatId, messageText);
  }
}

