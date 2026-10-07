import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';

@Injectable()
export class EchoToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ECHO;

  constructor(private readonly zaloService: ZaloService) {}

  public async execute(context: TextToolContext): Promise<void> {
    const echoContent = context.text.slice(5).trim();
    if (echoContent) {
      await this.zaloService.sendMessage(context.chatId, `Bạn vừa nói: ${echoContent}`);
    } else {
      await this.zaloService.sendMessage(
        context.chatId,
        'Hãy nhập gì đó sau lệnh /echo (ví dụ: /echo Xin chào)',
      );
    }
  }
}
