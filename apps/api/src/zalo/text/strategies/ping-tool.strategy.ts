import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';

@Injectable()
export class PingToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.PING;

  constructor(private readonly zaloService: ZaloService) {}

  public async execute(context: TextToolContext): Promise<void> {
    await this.zaloService.sendMessage(
      context.chatId,
      '🏓 Pong! Webhook Zalo Bot đang hoạt động bình thường.',
    );
  }
}
