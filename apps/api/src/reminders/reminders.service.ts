import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { IReminderTargetUser, ReminderTargetMode } from '@zalobot/contracts';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { type ReminderTarget, isSameTarget } from './reminder-target';
import { ReminderTargetService } from './reminder-target.service';

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
  remindAt: Date;
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
  remindAt?: Date;
  notifyType?: 'text' | 'call';
  repeatType?: 'none' | 'daily' | 'weekly';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(ReminderEntity)
    private readonly reminderRepo: Repository<ReminderEntity>,
    @Optional()
    private readonly targets?: ReminderTargetService,
  ) {}

  public async createReminder(dto: CreateReminderDto): Promise<ReminderEntity> {
    // Validate before saving so a bad value never leaves a saved row behind a reported error.
    const remindAt = toValidReminderDate(dto.remindAt);
    const userId = dto.userId.toString();
    const notifyType = dto.notifyType || 'text';
    const target = await this.resolveTarget(dto, null, userId, dto.originChatId);
    assertCallTarget(notifyType, target, userId);
    const reminder = this.reminderRepo.create({
      userId,
      title: dto.title.trim(),
      remindAt,
      notifyType,
      repeatType: dto.repeatType || 'none',
      status: dto.status || 'pending',
      snoozeCount: 0,
      isTriggered: false,
      ...targetColumns(target),
    });

    const saved = await this.reminderRepo.save(reminder);
    this.logger.log(
      `Created reminder "${dto.title}" [${saved.notifyType.toUpperCase()}] for user ${dto.userId} at ${remindAt.toISOString()}`,
    );
    return saved;
  }

  public async getDueReminders(): Promise<ReminderEntity[]> {
    const now = new Date();
    return this.reminderRepo.find({
      where: {
        remindAt: LessThanOrEqual(now),
        isTriggered: false,
      },
    });
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

  public async updateReminder(
    userId: number | string,
    id: string,
    input: UpdateReminderDto,
  ): Promise<ReminderEntity | null> {
    const reminder = await this.getUserReminder(userId, id);
    if (!reminder) return null;
    if (
      input.chatId !== undefined ||
      input.remindUserIds !== undefined ||
      input.remindMode !== undefined
    ) {
      const current = reminderTarget(reminder);
      const target = await this.resolveTarget(input, current, reminder.userId);
      if (target && !isSameTarget(current, target)) {
        Object.assign(reminder, targetColumns(target));
        // A new target re-arms a reminder that already went out.
        reminder.isTriggered = false;
        reminder.status = 'pending';
      }
    }
    if (input.title !== undefined) reminder.title = input.title.trim();
    if (input.remindAt !== undefined) {
      reminder.remindAt = input.remindAt;
      reminder.isTriggered = false;
      reminder.status = 'pending';
    }
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
    return this.reminderRepo.save(reminder);
  }

  public async markTriggered(reminderId: string): Promise<void> {
    const reminder = await this.reminderRepo.findOne({ where: { id: reminderId } });
    if (!reminder) return;

    if (reminder.repeatType === 'daily') {
      const nextDay = new Date(reminder.remindAt.getTime() + 24 * 60 * 60 * 1000);
      reminder.remindAt = nextDay;
      reminder.isTriggered = false;
      reminder.status = 'pending';
      await this.reminderRepo.save(reminder);
      this.logger.log(
        `Rescheduled daily reminder "${reminder.title}" for ${nextDay.toISOString()}`,
      );
    } else if (reminder.repeatType === 'weekly') {
      const nextWeek = new Date(reminder.remindAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      reminder.remindAt = nextWeek;
      reminder.isTriggered = false;
      reminder.status = 'pending';
      await this.reminderRepo.save(reminder);
      this.logger.log(
        `Rescheduled weekly reminder "${reminder.title}" for ${nextWeek.toISOString()}`,
      );
    } else {
      reminder.isTriggered = true;
      reminder.status = 'completed';
      reminder.completedAt = new Date();
      await this.reminderRepo.save(reminder);
    }
  }

  public async snoozeReminder(reminderId: string, minutes = 15): Promise<ReminderEntity | null> {
    const reminder = await this.reminderRepo.findOne({ where: { id: reminderId } });
    if (!reminder) return null;

    const newTime = new Date(Date.now() + minutes * 60 * 1000);
    reminder.remindAt = newTime;
    reminder.snoozedUntil = newTime;
    reminder.snoozeCount = (reminder.snoozeCount || 0) + 1;
    reminder.status = 'snoozed';
    reminder.isTriggered = false;
    const saved = await this.reminderRepo.save(reminder);

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
