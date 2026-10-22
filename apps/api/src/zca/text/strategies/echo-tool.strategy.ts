import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';

@Injectable()
export class EchoToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ECHO;

  constructor(private readonly zcaMessenger: ZcaMessengerService) {}

  public async execute(context: TextToolContext): Promise<void> {
    const echoContent = context.text.slice(5).trim();
    if (echoContent) {
      await this.zcaMessenger.sendMessage(context.chatId, `Bạn vừa nói: ${echoContent}`);
    } else {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        'Hãy nhập gì đó sau lệnh /echo (ví dụ: /echo Xin chào)',
      );
    }
  }
}
