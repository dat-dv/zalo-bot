import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';

@Injectable()
export class ResetToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.RESET;

  constructor(private readonly zcaMessenger: ZcaMessengerService) {}

  public async execute(context: TextToolContext): Promise<void> {
    await this.zcaMessenger.sendMessage(
      context.chatId,
      'Đã làm mới hội thoại, mình bắt đầu lại từ đầu.',
    );
  }
}
