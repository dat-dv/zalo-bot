import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';

@Injectable()
export class ResetToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.RESET;

  constructor(private readonly zaloService: ZaloService) {}

  public async execute(context: TextToolContext): Promise<void> {
    await this.zaloService.sendMessage(
      context.chatId,
      '🧹 Đã làm mới ngữ cảnh hội thoại. Bạn có thể bắt đầu phiên trò chuyện mới!',
    );
  }
}
