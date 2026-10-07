import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';

@Injectable()
export class StartToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.START;

  constructor(private readonly zaloService: ZaloService) {}

  public async execute(context: TextToolContext): Promise<void> {
    await this.zaloService.sendMessage(
      context.chatId,
      `👋 Chào ${context.displayName}! Tôi là chatbot trên Zalo.\n\n` +
        'Gõ /help để xem danh sách các lệnh hỗ trợ.',
    );
  }
}
