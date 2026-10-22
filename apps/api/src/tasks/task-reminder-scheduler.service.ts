import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DEFAULT_LOCALE } from '@zalobot/contracts';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { formatTaskReminderMessage } from './task.mapper';
import { TasksService } from './tasks.service';

/** Posts each open task into its reminder chat once its reminder time has come. */
@Injectable()
export class TaskReminderSchedulerService {
  private readonly logger = new Logger(TaskReminderSchedulerService.name);
  private running = false;

  constructor(
    private readonly tasks: TasksService,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
    @Inject(forwardRef(() => ZcaMessengerService))
    private readonly zcaMessenger: ZcaMessengerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  public async handleCron(): Promise<void> {
    // A slow tick must not overlap the next one; `markTaskReminded` also guards duplicates.
    if (this.running) return;
    this.running = true;
    try {
      await this.sendDueReminders();
    } catch (err: unknown) {
      this.logger.error(
        `Task reminder tick failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }

  public async sendDueReminders(now: Date = new Date()): Promise<void> {
    // While ZCA is logged out the reminders wait, so they still go out after the next login.
    if (!this.zcaMessenger.isConnected()) return;
    const due = await this.tasks.getDueTaskReminders(now);
    for (const task of due) {
      const chatId = task.remindChatId;
      if (!chatId) continue;
      // Claim first: whoever marks it sends it, so it never goes out twice.
      if (!(await this.tasks.markTaskReminded(task.id, now))) continue;
      if (await this.tasks.isUnlistenedGroup(chatId)) {
        this.logger.warn(`Skipped reminder of task ${task.id}: group ${chatId} is not listened.`);
        continue;
      }
      const locale = task.createdByUserId
        ? await this.users.getPreferredLocale(task.createdByUserId)
        : DEFAULT_LOCALE;
      const sent = await this.zcaMessenger.sendMessage(
        chatId,
        formatTaskReminderMessage(task, locale),
      );
      if (sent) this.logger.log(`Sent reminder of task ${task.id} to ${chatId}.`);
      else this.logger.error(`Could not send reminder of task ${task.id} to ${chatId}.`);
    }
  }
}
