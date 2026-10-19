import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ReminderEntity } from '../database/entities/reminder.entity';

export interface CreateReminderDto {
  userId: number | string;
  title: string;
  remindAt: Date;
  notifyType?: 'text' | 'call';
  repeatType?: 'none' | 'daily' | 'weekly';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
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

export interface UpdateReminderDto {
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
  ) {}

  public async createReminder(dto: CreateReminderDto): Promise<ReminderEntity> {
    // Validate before saving so a bad value never leaves a saved row behind a reported error.
    const remindAt = toValidReminderDate(dto.remindAt);
    const reminder = this.reminderRepo.create({
      userId: dto.userId.toString(),
      title: dto.title.trim(),
      remindAt,
      notifyType: dto.notifyType || 'text',
      repeatType: dto.repeatType || 'none',
      status: dto.status || 'pending',
      snoozeCount: 0,
      isTriggered: false,
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
    if (input.title !== undefined) reminder.title = input.title.trim();
    if (input.remindAt !== undefined) {
      reminder.remindAt = input.remindAt;
      reminder.isTriggered = false;
      reminder.status = 'pending';
    }
    if (input.notifyType !== undefined) reminder.notifyType = input.notifyType;
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
}
