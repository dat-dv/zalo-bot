import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';

@Injectable()
export class ConversationToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CONVERSATION;
  private readonly logger = new Logger(ConversationToolStrategy.name);

  constructor(private readonly zcaMessenger: ZcaMessengerService) {}

  public async execute(context: TextToolContext): Promise<void> {
    const messageText =
      context.aiReplyText ||
      `Đã nhận tin nhắn: "${context.text}". Gõ /help để xem danh sách các lệnh hỗ trợ.`;

    await this.zcaMessenger.sendMessage(context.chatId, messageText);
  }
}
