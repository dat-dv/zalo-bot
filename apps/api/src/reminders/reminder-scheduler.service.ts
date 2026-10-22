import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { localeTag, translate } from '@zalobot/contracts';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ZcaMessengerService))
    private readonly zcaMessenger: ZcaMessengerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  public async handleCron(): Promise<void> {
    try {
      const dueReminders = await this.remindersService.getDueReminders();
      if (dueReminders.length === 0) return;

      this.logger.log(`Found ${dueReminders.length} due reminder(s) to process.`);

      for (const reminder of dueReminders) {
        const userId = reminder.userId;
        if (!userId) continue;

        const locale = await this.usersService.getPreferredLocale(userId);
        const timeStr = new Intl.DateTimeFormat(localeTag(locale), {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          weekday: 'short',
        }).format(new Date(reminder.remindAt));

        const reminderHeader = translate(locale, 'reminder.header.text');
        const reminderMessage = `${reminderHeader}
━━━━━━━━━━━━━━━━━━━━
📌 Nội dung: ${reminder.title}
⏰ Thời điểm: ${timeStr}
━━━━━━━━━━━━━━━━━━━━`;

        await this.zcaMessenger.sendMessage(userId, reminderMessage);
        await this.remindersService.markTriggered(reminder.id);
        this.logger.log(
          `Triggered reminder "${reminder.title}" for user ${userId}: ${reminderMessage}`,
        );
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error in ReminderSchedulerService: ${error.message}`);
    }
  }
}
