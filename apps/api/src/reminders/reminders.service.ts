import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IReminderTargetUser, ReminderTargetMode } from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { ReminderTimeEntity } from '../database/entities/reminder-time.entity';
import { ReminderEntity } from '../database/entities/reminder.entity';
import type { ReminderTarget } from './reminder-target';
import { ReminderTargetService } from './reminder-target.service';
import {
  type ReminderTimesPlan,
  nextPendingReminderAt,
  nextRepeatAt,
  planReminderTimes,
  reminderTimesErrorMessage,
} from './reminder-times';

/** Where a reminder goes; omitted fields keep the current target (or the default). */
export interface ReminderTargetFields {
  /** Defaults to the owner's private chat. */
  chatId?: string;
  /** Dashboard picks among the group's members; `[]` clears them. */
  remindUserIds?: string[];
  /** People tagged in a bot message (already real Zalo users). */
  remindUsers?: IReminderTargetUser[];
  remindMode?: ReminderTargetMode;
}

export interface CreateReminderDto extends ReminderTargetFields {
  userId: number | string;
  title: string;
  /** One time (kept for older callers and pending actions); `remindTimes` wins. */
  remindAt?: Date;
  remindTimes?: Date[];
  notifyType?: 'text' | 'call';
  repeatType?: 'none' | 'daily' | 'weekly';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  /** The chat the bot was asked in (trusted as a target); none for the dashboard. */
  originChatId?: string;
}

/**
 * Accepts a Date or an ISO string (pending actions round-trip through Redis as JSON,
 * which turns Date into string) and returns a valid Date, or throws.
 */
export function toValidReminderDate(value: unknown): Date {
  const date =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Thời gian nhắc (remindAt) không hợp lệ.');
  }
  return date;
}

export interface UpdateReminderDto extends Omit<ReminderTargetFields, 'remindUsers'> {
  title?: string;
  /** Replaces the times; times already saved keep whether they were sent. */
  remindTimes?: Date[];
  notifyType?: 'text' | 'call';
  repeatType?: 'none' | 'daily' | 'weekly';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
}

/** A reminder time that is due, with its reminder. */
export type DueReminderTime = ReminderTimeEntity & { reminder: ReminderEntity };

/** Due reminder times handled per scheduler tick. */
const DUE_REMINDER_BATCH = 50;

/**
 * Personal reminders. A reminder can remind several times (`reminder_times`);
 * `reminders.remind_at` is the next time not sent, and a reminder is done (`is_triggered`)
 * once every time went out. A repeating reminder moves each time forward instead.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(ReminderEntity)
    private readonly reminderRepo: Repository<ReminderEntity>,
    @Optional()
    private readonly targets?: ReminderTargetService,
    @Optional()
    @InjectRepository(ReminderTimeEntity)
    private readonly timeRepo?: Repository<ReminderTimeEntity>,
  ) {}

  public async createReminder(dto: CreateReminderDto): Promise<ReminderEntity> {
    // Validate before saving so a bad value never leaves a saved row behind a reported error.
    const requested = dto.remindTimes?.length
      ? dto.remindTimes
      : dto.remindAt
        ? [dto.remindAt]
        : [];
    const times = this.planTimes([], requested.map(toValidReminderDate)).add;
    if (times.length === 0) throw new BadRequestException('Lời nhắc cần ít nhất một giờ nhắc.');
    const userId = dto.userId.toString();
    const notifyType = dto.notifyType || 'text';
    const target = await this.resolveTarget(dto, null, userId, dto.originChatId);
    assertCallTarget(notifyType, target, userId);
    const saved = await this.reminderRepo.save(
      this.reminderRepo.create({
        userId,
        title: dto.title.trim(),
        remindAt: times[0],
        notifyType,
        repeatType: dto.repeatType || 'none',
        status: dto.status || 'pending',
        snoozeCount: 0,
        isTriggered: false,
        ...targetColumns(target),
      }),
    );
    await this.applyTimes(saved.id, { keep: [], remove: [], add: times });
    this.logger.log(
      `Created reminder "${dto.title}" [${saved.notifyType.toUpperCase()}] for user ${dto.userId} at ${times.map((t) => t.toISOString()).join(', ')}`,
    );
    return saved;
  }

  /** Times that are due, of reminders not done yet, oldest first. */
  public async getDueReminders(now: Date = new Date()): Promise<DueReminderTime[]> {
    if (!this.timeRepo) return [];
    const rows = await this.timeRepo
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.reminder', 'reminder')
      .where('time.sent_at IS NULL')
      .andWhere('time.remind_at <= :now', { now })
      .andWhere('reminder.is_triggered = false')
      .orderBy('time.remind_at', 'ASC')
      .take(DUE_REMINDER_BATCH)
      .getMany();
    return rows.filter((row): row is DueReminderTime => !!row.reminder);
  }

  /**
   * Claims a due time: a one-off reminder marks it sent, a repeating one moves it to its next
   * occurrence. The update only matches the time as read, so overlapping scheduler ticks
   * cannot both send it; returns whether this call claimed it.
   */
  public async claimReminderTime(time: DueReminderTime, now: Date = new Date()): Promise<boolean> {
    if (!this.timeRepo) return false;
    const { repeatType } = time.reminder;
    const change =
      repeatType === 'daily' || repeatType === 'weekly'
        ? { remindAt: nextRepeatAt(time.remindAt, repeatType, now) }
        : { sentAt: now };
    const result = await this.timeRepo.update(
      { id: time.id, sentAt: IsNull(), remindAt: time.remindAt },
      change,
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Gives a claimed time back (its delivery could not be queued or sent) so the next scan
   * retries it: `firedAt` restores the occurrence a repeating reminder had moved past.
   */
  public async releaseReminderTime(timeId: string, firedAt: Date): Promise<void> {
    if (!this.timeRepo) return;
    await this.timeRepo.update({ id: timeId }, { sentAt: null, remindAt: firedAt });
  }

  /** One reminder time with its reminder, or null once the reminder was deleted. */
  public async getReminderTime(timeId: string): Promise<DueReminderTime | null> {
    if (!this.timeRepo) return null;
    const row = await this.timeRepo.findOne({
      where: { id: timeId },
      relations: { reminder: true },
    });
    return row?.reminder ? { ...row, reminder: row.reminder } : null;
  }

  /**
   * Recomputes the parent from its times: `remind_at` is the next time not sent; with none
   * left the reminder is completed.
   */
  public async refreshReminderSummary(reminder: ReminderEntity): Promise<void> {
    const next = nextPendingReminderAt(await this.loadTimes([reminder.id]));
    const summary: Partial<ReminderEntity> = next
      ? { remindAt: next, isTriggered: false }
      : { isTriggered: true, status: 'completed', completedAt: new Date() };
    if (next && reminder.status === 'completed') summary.status = 'pending';
    Object.assign(reminder, summary);
    await this.reminderRepo.update({ id: reminder.id }, summary);
  }

  public async getUserUpcomingReminders(userId: number | string): Promise<ReminderEntity[]> {
    return this.reminderRepo.find({
      where: {
        userId: userId.toString(),
        isTriggered: false,
      },
      order: {
        remindAt: 'ASC',
      },
    });
  }

  public getUserReminder(userId: number | string, id: string): Promise<ReminderEntity | null> {
    return this.reminderRepo.findOne({ where: { id, userId: userId.toString() } });
  }

  /** Times of the given reminders, earliest first. */
  public async loadTimes(reminderIds: readonly string[]): Promise<ReminderTimeEntity[]> {
    if (!this.timeRepo || reminderIds.length === 0) return [];
    return this.timeRepo.find({
      where: { reminderId: In([...reminderIds]) },
      order: { remindAt: 'ASC' },
    });
  }

  /** Changing the target only affects times not sent yet: sent times are never re-sent. */
  public async updateReminder(
    userId: number | string,
    id: string,
    input: UpdateReminderDto,
  ): Promise<ReminderEntity | null> {
    const reminder = await this.getUserReminder(userId, id);
    if (!reminder) return null;
    let plan: ReminderTimesPlan<ReminderTimeEntity> | null = null;
    if (input.remindTimes !== undefined) {
      plan = this.planTimes(await this.loadTimes([reminder.id]), input.remindTimes);
      if (plan.keep.length + plan.add.length === 0) {
        throw new BadRequestException('Lời nhắc cần ít nhất một giờ nhắc.');
      }
    }
    if (
      input.chatId !== undefined ||
      input.remindUserIds !== undefined ||
      input.remindMode !== undefined
    ) {
      const target = await this.resolveTarget(input, reminderTarget(reminder), reminder.userId);
      Object.assign(reminder, targetColumns(target));
    }
    if (input.title !== undefined) reminder.title = input.title.trim();
    if (input.notifyType !== undefined) reminder.notifyType = input.notifyType;
    assertCallTarget(reminder.notifyType, reminderTarget(reminder), reminder.userId);
    if (input.repeatType !== undefined) reminder.repeatType = input.repeatType;
    if (input.status !== undefined) {
      reminder.status = input.status;
      if (input.status === 'completed') {
        reminder.isTriggered = true;
        reminder.completedAt = new Date();
      }
    }
    const saved = await this.reminderRepo.save(reminder);
    if (plan) {
      await this.applyTimes(saved.id, plan);
      await this.refreshReminderSummary(saved);
    }
    return saved;
  }

  /** Moves the next time not sent to `minutes` from now. */
  public async snoozeReminder(reminderId: string, minutes = 15): Promise<ReminderEntity | null> {
    const reminder = await this.reminderRepo.findOne({ where: { id: reminderId } });
    if (!reminder) return null;
    const next = (await this.loadTimes([reminder.id])).find((time) => !time.sentAt);
    const newTime = new Date(Date.now() + minutes * 60 * 1000);
    if (next) await this.timeRepo?.update({ id: next.id }, { remindAt: newTime });
    else await this.applyTimes(reminder.id, { keep: [], remove: [], add: [newTime] });
    reminder.snoozedUntil = newTime;
    reminder.snoozeCount = (reminder.snoozeCount || 0) + 1;
    reminder.status = 'snoozed';
    const saved = await this.reminderRepo.save(reminder);
    await this.refreshReminderSummary(saved);
    this.logger.log(
      `Snoozed reminder "${reminder.title}" for ${minutes} minutes (until ${newTime.toISOString()})`,
    );
    return saved;
  }

  public async markCompleted(
    reminderId: string,
    userId?: number | string,
  ): Promise<ReminderEntity | null> {
    const whereCondition: Record<string, unknown> = { id: reminderId };
    if (userId) {
      whereCondition.userId = userId.toString();
    }
    const reminder = await this.reminderRepo.findOne({ where: whereCondition });
    if (!reminder) return null;
    reminder.isTriggered = true;
    reminder.status = 'completed';
    reminder.completedAt = new Date();
    return this.reminderRepo.save(reminder);
  }

  public async updateNotifyType(
    reminderId: string,
    notifyType: 'text' | 'call',
  ): Promise<ReminderEntity | null> {
    const reminder = await this.reminderRepo.findOne({ where: { id: reminderId } });
    if (!reminder) return null;

    reminder.notifyType = notifyType;
    const saved = await this.reminderRepo.save(reminder);
    this.logger.log(
      `Updated reminder "${reminder.title}" notifyType to ${notifyType.toUpperCase()}`,
    );
    return saved;
  }

  public async deleteReminder(reminderId: string, userId?: number | string): Promise<boolean> {
    const whereCondition: Record<string, unknown> = { id: reminderId };
    if (userId) {
      whereCondition.userId = userId.toString();
    }

    const reminder = await this.reminderRepo.findOne({ where: whereCondition });
    if (!reminder) return false;

    await this.reminderRepo.remove(reminder);
    this.logger.log(`Deleted reminder "${reminder.title}" (${reminderId})`);
    return true;
  }

  private planTimes(current: readonly ReminderTimeEntity[], requested: readonly Date[]) {
    // Reminders never refused a past time: it goes out on the next tick (the form checks it).
    const result = planReminderTimes(current, requested, new Date(), { allowPast: true });
    if ('error' in result) throw new BadRequestException(reminderTimesErrorMessage(result.error));
    return result.plan;
  }

  private async applyTimes(
    reminderId: string,
    plan: ReminderTimesPlan<ReminderTimeEntity>,
  ): Promise<void> {
    const repo = this.timeRepo;
    if (!repo) return;
    if (plan.remove.length > 0) await repo.delete(plan.remove.map((time) => time.id));
    if (plan.add.length > 0) {
      await repo.save(
        plan.add.map((remindAt) => repo.create({ reminderId, remindAt, sentAt: null })),
      );
    }
  }

  /**
   * The target via `ReminderTargetService`, defaulting to the owner's private chat. Without
   * the service (unit tests of other modules) a reminder keeps the old private-chat target.
   */
  private async resolveTarget(
    input: ReminderTargetFields,
    current: ReminderTarget | null,
    userId: string,
    originChatId?: string,
  ): Promise<ReminderTarget | null> {
    if (!this.targets) return current;
    return this.targets.resolve(
      {
        chatId: input.chatId,
        userIds: input.remindUserIds,
        users: input.remindUsers,
        mode: input.remindMode,
      },
      current,
      { userId, chatId: originChatId },
      'self',
    );
  }
}

/** The target of a reminder; rows from before reminder targets go to the owner's private chat. */
export function reminderTarget(row: ReminderEntity): ReminderTarget {
  return {
    chatId: row.chatId || row.userId,
    users: row.remindUsers ?? [],
    mode: row.remindMode ?? 'mention',
  };
}

function targetColumns(
  target: ReminderTarget | null,
): Pick<ReminderEntity, 'chatId' | 'remindUsers' | 'remindMode'> {
  if (!target) return {};
  return { chatId: target.chatId, remindUsers: target.users, remindMode: target.mode };
}

/** A call reaches one person, so it only makes sense for the owner's own private chat. */
function assertCallTarget(
  notifyType: 'text' | 'call',
  target: ReminderTarget | null,
  userId: string,
): void {
  if (notifyType === 'call' && target && target.chatId !== userId) {
    throw new BadRequestException('Gọi điện chỉ dùng khi gửi vào chat riêng của bạn.');
  }
}
