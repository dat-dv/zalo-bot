import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DEFAULT_LOCALE } from '@zalobot/contracts';
import { ReminderTargetService } from '../reminders/reminder-target.service';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { formatTaskReminderMessage } from './task.mapper';
import { TasksService } from './tasks.service';

/** Sends an open task to its reminder target at each of its reminder times. */
@Injectable()
export class TaskReminderSchedulerService {
  private readonly logger = new Logger(TaskReminderSchedulerService.name);
  private running = false;

  constructor(
    private readonly tasks: TasksService,
    @Inject(forwardRef(() => ReminderTargetService))
    private readonly targets: ReminderTargetService,
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
    for (const time of due) {
      const { task } = time;
      const chatId = task.remindChatId;
      if (!chatId) continue;
      // Claim first: whoever marks this time sends it, so it never goes out twice.
      if (!(await this.tasks.markTaskReminderSent(time.id, now))) continue;
      await this.tasks.refreshReminderSummary(task);
      const locale = task.createdByUserId
        ? await this.users.getPreferredLocale(task.createdByUserId)
        : DEFAULT_LOCALE;
      const result = await this.targets.deliver(
        { chatId, users: task.remindUsers ?? [], mode: task.remindMode ?? 'mention' },
        formatTaskReminderMessage(task, locale),
        locale,
      );
      if (result === 'failed') {
        this.logger.error(`Could not send reminder of task ${task.id} to ${chatId}.`);
      }
    }
  }
}
