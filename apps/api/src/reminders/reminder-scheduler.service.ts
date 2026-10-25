import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { localeTag, translate } from '@zalobot/contracts';
import { REMINDER_DELIVERY_JOB_OPTIONS, REMINDER_JOBS } from '../queue/queue.constants';
import type { ReminderJobResult } from '../queue/reminder-job';
import {
  type ReminderDeliveryJobData,
  type ReminderDeliveryQueue,
  deliveryJobData,
  deliveryOccurrence,
} from '../queue/reminder-queue';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { REMINDERS_QUEUE, reminderJobId } from './reminder.queue';
import { withNagLine } from './reminder-rule.format';
import { RemindersService, reminderTarget } from './reminders.service';
import { ReminderTargetService } from './reminder-target.service';

/**
 * Sends personal reminders in two BullMQ jobs: a scan claims due times and queues one delivery
 * each; a delivery sends it, and is retried by the queue when sending fails.
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly targets: ReminderTargetService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ZcaMessengerService))
    private readonly zcaMessenger: ZcaMessengerService,
    @InjectQueue(REMINDERS_QUEUE)
    private readonly queue: ReminderDeliveryQueue,
  ) {}

  public async scanDueReminders(now: Date = new Date()): Promise<void> {
    // While ZCA is logged out the reminders wait, so they still go out after the next login.
    if (!this.zcaMessenger.isConnected()) return;
    const dueTimes = await this.remindersService.getDueReminders(now);
    if (dueTimes.length === 0) return;

    this.logger.log(`Found ${dueTimes.length} due reminder time(s) to process.`);

    for (const time of dueTimes) {
      if (!time.reminder.userId) continue;
      // Claim first: whoever claims this send queues it, so it never goes out twice.
      const occurrence = await this.remindersService.claimReminderTime(time, now);
      if (!occurrence) continue;
      try {
        await this.queue.add(REMINDER_JOBS.DELIVER, deliveryJobData(time.id, occurrence), {
          ...REMINDER_DELIVERY_JOB_OPTIONS,
          jobId: reminderJobId(time.id, occurrence),
        });
      } catch (err: unknown) {
        await this.remindersService.releaseReminderTime(time.id, occurrence);
        this.logger.error(
          `Could not queue reminder time ${time.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        continue;
      }
      await this.remindersService.refreshReminderSummary(time.reminder);
    }
  }

  /** Sends one claimed occurrence; a reminder deleted since then is not sent. */
  public async deliverReminder(data: ReminderDeliveryJobData): Promise<ReminderJobResult> {
    const time = await this.remindersService.getReminderTime(data.timeId);
    const reminder = time?.reminder;
    const userId = reminder?.userId;
    if (!reminder || !userId) return 'skipped';
    // Logged out since the scan: retrying would only burn the attempts, so wait for the login.
    if (!this.zcaMessenger.isConnected()) {
      await this.remindersService.releaseReminderTime(data.timeId, deliveryOccurrence(data));
      await this.remindersService.refreshReminderSummary(reminder);
      return 'released';
    }

    const locale = await this.usersService.getPreferredLocale(userId);
    // The occurrence that fired: a repeating reminder has already moved `remindAt` forward.
    const timeStr = new Intl.DateTimeFormat(localeTag(locale), {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      weekday: 'short',
    }).format(new Date(data.remindAt));

    // Calls are not placed yet: a `call` reminder is sent as a message like the others.
    const header = withNagLine(
      translate(locale, 'reminder.header.text', { title: reminder.title }),
      data.nag,
      locale,
    );
    // The title is in the header; the body is just the time of this occurrence.
    const body = timeStr;

    const target = reminderTarget(reminder);
    const result = await this.targets.deliver(target, { header, body }, locale);
    this.logger.log(
      `Reminder "${reminder.title}" of user ${userId} to ${target.chatId}: ${result}`,
    );
    return result;
  }
}
