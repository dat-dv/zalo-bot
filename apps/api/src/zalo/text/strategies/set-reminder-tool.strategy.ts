import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { RemindersService } from '../../../reminders/reminders.service';

@Injectable()
export class SetReminderToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SET_REMINDER;
  private readonly logger = new Logger(SetReminderToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly remindersService: RemindersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs || {};
    const title =
      typeof args.title === 'string' && args.title.trim()
        ? args.title.trim()
        : 'Nhắc nhở công việc';
    const remindAtStr =
      typeof args.remindAt === 'string' && args.remindAt.trim() ? args.remindAt.trim() : '';
    const remindAt = remindAtStr ? new Date(remindAtStr) : new Date(Date.now() + 60 * 60 * 1000);

    try {
      const reminder = await this.remindersService.createReminder({
        userId: context.senderId,
        title,
        remindAt: isNaN(remindAt.getTime()) ? new Date(Date.now() + 3600000) : remindAt,
      });

      const formattedTime = reminder.remindAt.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      const reply =
        `⏰ Đã đặt lịch nhắc thành công!\n\n` +
        `• Nội dung: ${reminder.title}\n` +
        `• Thời gian: ${formattedTime}`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to create reminder: ${(err as Error).message}`);
      await this.zaloService.sendMessage(context.chatId, '⚠️ Có lỗi xảy ra khi tạo lịch nhắc.');
    }
  }
}
