import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { RemindersService } from '../../../reminders/reminders.service';
import { repeatLabel } from '../../../reminders/reminder-rule.format';

@Injectable()
export class RemindersQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.REMINDERS;
  private readonly logger = new Logger(RemindersQuickToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly remindersService: RemindersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const upcoming = await this.remindersService.getUserUpcomingReminders(context.senderId);

      if (upcoming.length === 0) {
        await this.zcaMessenger.sendMessage(context.chatId, 'Bạn không có lời nhắc nào sắp tới.');
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
        const repeat =
          r.repeatType !== 'none'
            ? ` · ${repeatLabel({ repeatType: r.repeatType, repeatWeekdays: [] }).toLocaleLowerCase('vi')}`
            : '';
        return `${idx + 1}. ${timeStr} · ${r.title}${repeat}`;
      });

      const reply = `Lời nhắc sắp tới (${upcoming.length}):\n` + reminderLines.join('\n');

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list reminders: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa xem được lời nhắc, thử lại sau.',
      );
    }
  }
}
