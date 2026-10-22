import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { DEFAULT_LOCALE } from '@zalobot/contracts';
import { REMINDER_DELIVERY_JOB_OPTIONS, REMINDER_JOBS } from '../queue/queue.constants';
import type { ReminderDeliveryJobData, ReminderDeliveryQueue } from '../queue/reminder-queue';
import type { ReminderJobResult } from '../queue/reminder-job';
import { ReminderTargetService } from '../reminders/reminder-target.service';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { formatTaskReminderMessage } from './task.mapper';
import { TASK_REMINDERS_QUEUE, taskReminderJobId } from './task-reminder.queue';
import { TasksService } from './tasks.service';

/**
 * Sends an open task to its reminder target at each of its reminder times, in two BullMQ
 * jobs: a scan claims due times and queues one delivery each; a delivery sends it, and is
 * retried by the queue when sending fails.
 */
@Injectable()
export class TaskReminderSchedulerService {
  private readonly logger = new Logger(TaskReminderSchedulerService.name);

  constructor(
    private readonly tasks: TasksService,
    @Inject(forwardRef(() => ReminderTargetService))
    private readonly targets: ReminderTargetService,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
    @Inject(forwardRef(() => ZcaMessengerService))
    private readonly zcaMessenger: ZcaMessengerService,
    @InjectQueue(TASK_REMINDERS_QUEUE)
    private readonly queue: ReminderDeliveryQueue,
  ) {}

  public async scanDueReminders(now: Date = new Date()): Promise<void> {
    // While ZCA is logged out the reminders wait, so they still go out after the next login.
    if (!this.zcaMessenger.isConnected()) return;
    const due = await this.tasks.getDueTaskReminders(now);
    for (const time of due) {
      // Claim first: whoever marks this time queues it, so it never goes out twice.
      if (!(await this.tasks.markTaskReminderSent(time.id, now))) continue;
      const data: ReminderDeliveryJobData = {
        timeId: time.id,
        remindAt: time.remindAt.toISOString(),
      };
      try {
        await this.queue.add(REMINDER_JOBS.DELIVER, data, {
          ...REMINDER_DELIVERY_JOB_OPTIONS,
          jobId: taskReminderJobId(time.id),
        });
      } catch (err: unknown) {
        await this.tasks.releaseTaskReminderTime(time.id);
        this.logger.error(
          `Could not queue reminder ${time.id} of task ${time.taskId}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        continue;
      }
      await this.tasks.refreshReminderSummary(time.task);
    }
  }

  /** Sends one claimed time; a task done or deleted since then is not reminded any more. */
  public async deliverReminder(data: ReminderDeliveryJobData): Promise<ReminderJobResult> {
    const time = await this.tasks.getTaskReminderTime(data.timeId);
    const task = time?.task;
    if (!task || task.deletedAt || task.status !== 'needsAction' || !task.remindChatId) {
      return 'skipped';
    }
    // Logged out since the scan: retrying would only burn the attempts, so wait for the login.
    if (!this.zcaMessenger.isConnected()) {
      await this.tasks.releaseTaskReminderTime(data.timeId);
      await this.tasks.refreshReminderSummary(task);
      return 'released';
    }
    const locale = task.createdByUserId
      ? await this.users.getPreferredLocale(task.createdByUserId)
      : DEFAULT_LOCALE;
    const result = await this.targets.deliver(
      {
        chatId: task.remindChatId,
        users: task.remindUsers ?? [],
        mode: task.remindMode ?? 'mention',
      },
      formatTaskReminderMessage(task, locale),
      locale,
    );
    if (result === 'failed') {
      this.logger.error(`Could not send reminder of task ${task.id} to ${task.remindChatId}.`);
    }
    return result;
  }
}
