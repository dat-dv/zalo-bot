import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { RemindersService } from '../../../reminders/reminders.service';

@Injectable()
export class RemindersQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.REMINDERS;
  private readonly logger = new Logger(RemindersQuickToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly remindersService: RemindersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const upcoming = await this.remindersService.getUserUpcomingReminders(context.senderId);

      if (upcoming.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '⏰ LỜI NHẮC HẸN\n\nHiện tại bạn không có lời nhắc nào sắp tới.',
        );
        return;
      }

      const reminderLines = upcoming.map((r, idx) => {
        const timeStr = new Date(r.remindAt).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const repeat = r.repeatType !== 'none' ? ` (Lặp: ${r.repeatType})` : '';
        return `  ${idx + 1}. ⏰ [${timeStr}] ${r.title}${repeat}`;
      });

      const reply =
        `⏰ DANH SÁCH LỜI NHẮC SẮP TỚI (${upcoming.length})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        reminderLines.join('\n') +
        `\n\n💡 Nhắn cho bot tự nhiên: "Mai 9h sáng nhắc đi họp" để tạo lời nhắc mới!`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list reminders: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tra cứu danh sách lời nhắc.',
      );
    }
  }
}
