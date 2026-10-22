import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService, reminderTarget } from './reminders.service';
import { ReminderTargetService } from './reminder-target.service';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { localeTag, translate } from '@zalobot/contracts';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly targets: ReminderTargetService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ZcaMessengerService))
    private readonly zcaMessenger: ZcaMessengerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  public async handleCron(): Promise<void> {
    try {
      // While ZCA is logged out the reminders wait, so they still go out after the next login.
      if (!this.zcaMessenger.isConnected()) return;
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

        // Calls are not placed yet: a `call` reminder is sent as a message like the others.
        const header = translate(locale, 'reminder.header.text');
        const body = `━━━━━━━━━━━━━━━━━━━━
📌 Nội dung: ${reminder.title}
⏰ Thời điểm: ${timeStr}
━━━━━━━━━━━━━━━━━━━━`;

        const target = reminderTarget(reminder);
        const result = await this.targets.deliver(target, { header, body }, locale);
        await this.remindersService.markTriggered(reminder.id);
        this.logger.log(
          `Reminder "${reminder.title}" of user ${userId} to ${target.chatId}: ${result}`,
        );
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error in ReminderSchedulerService: ${error.message}`);
    }
  }
}
