import { Injectable } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';

@Injectable()
export class HelpToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.HELP;

  constructor(private readonly zaloService: ZaloService) {}

  public async execute(context: TextToolContext): Promise<void> {
    await this.zaloService.sendMessage(
      context.chatId,
      '📖 Danh sách lệnh hỗ trợ:\n\n' +
        '• /start - Bắt đầu & giới thiệu bot\n' +
        '• /help - Hướng dẫn sử dụng\n' +
        '• /echo <nội dung> - Bot phản hồi lại nội dung bạn vừa nhập\n' +
        '• /clear hoặc /reset - Xóa ngữ cảnh hội thoại hiện tại\n' +
        '• /ping - Kiểm tra trạng thái hoạt động của bot',
    );
  }
}
