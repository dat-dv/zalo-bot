import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type IReminderTargetUser,
  REMINDER_LIST_LIMITS,
  type ReminderListStatus,
  type ReminderRepeatType,
  type ReminderTargetMode,
} from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { ReminderTimeEntity } from '../database/entities/reminder-time.entity';
import { ReminderEntity } from '../database/entities/reminder.entity';
import type { ReminderTarget } from './reminder-target';
import { ReminderTargetService } from './reminder-target.service';
import {
  NO_NAG_RULE,
  NO_NAG_STATE,
  NO_REPEAT,
  type NagRule,
  type NagRuleInput,
  type ReminderOccurrence,
  type ReminderRepeat,
  checkReminderRules,
  claimedState,
  dueOccurrence,
  hasNag,
  isSameRepeat,
  mergeNagRule,
  nagRuleOf,
  releasedState,
  reminderRuleErrorMessage,
  repeatChangeState,
  repeatOf,
  timeRule,
  touchesNagRule,
} from './reminder-schedule';
import {
  type ReminderTimesPlan,
  type RequestedReminderTime,
  asRequestedTimes,
  nextPendingReminderAt,
  planReminderTimes,
  plannedRepeats,
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

export interface CreateReminderDto extends ReminderTargetFields, NagRuleInput {
  userId: number | string;
  title: string;
  /** One time (kept for older callers and pending actions); `remindTimes` wins. */
  remindAt?: Date;
  /** Times, each with its own repeat; a plain date repeats as `repeatType`. */
  remindTimes?: readonly (Date | RequestedReminderTime)[];
  /** Legacy: the repeat of times given without one. */
  repeatType?: ReminderRepeatType;
  notifyType?: 'text' | 'call';
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

export interface UpdateReminderDto extends Omit<ReminderTargetFields, 'remindUsers'>, NagRuleInput {
  title?: string;
  /** Replaces the times; times already saved keep whether they were sent. */
  remindTimes?: readonly (Date | RequestedReminderTime)[];
  /**
   * Legacy: the repeat of times given without one; without `remindTimes`, the repeat of every
   * time of the reminder.
   */
  repeatType?: ReminderRepeatType;
  notifyType?: 'text' | 'call';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
}

/** A reminder time that is due, with its reminder. */
export type DueReminderTime = ReminderTimeEntity & { reminder: ReminderEntity };

/** Due reminder times handled per scheduler tick. */
const DUE_REMINDER_BATCH = 50;

/**
 * Personal reminders. A reminder can remind several times (`reminder_times`);
 * `reminders.remind_at` is the next send, and a reminder is done (`is_triggered`) once every
 * time and every reminder again went out. A repeating reminder moves each time forward instead.
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
    const legacyRepeat: ReminderRepeat | undefined = dto.repeatType
      ? { repeatType: dto.repeatType, repeatWeekdays: [] }
      : undefined;
    const plan = this.planTimes([], asRequestedTimes(requested.map(validTime), legacyRepeat));
    const times = plan.add;
    if (times.length === 0) throw new BadRequestException('Lời nhắc cần ít nhất một giờ nhắc.');
    const nag = this.checkRules(plannedRepeats(plan), mergeNagRule(NO_NAG_RULE, dto));
    const userId = dto.userId.toString();
    const notifyType = dto.notifyType || 'text';
    const target = await this.resolveTarget(dto, null, userId, dto.originChatId);
    assertCallTarget(notifyType, target, userId);
    const saved = await this.reminderRepo.save(
      this.reminderRepo.create({
        userId,
        title: dto.title.trim(),
        remindAt: times[0].at,
        notifyType,
        repeatType: times[0].repeat.repeatType,
        ...nagColumns(nag),
        status: dto.status || 'pending',
        snoozeCount: 0,
        isTriggered: false,
        ...targetColumns(target),
      }),
    );
    await this.applyTimes(saved.id, plan);
    this.logger.log(
      `Created reminder "${dto.title}" [${saved.notifyType.toUpperCase()}] for user ${dto.userId} at ${times.map((t) => t.at.toISOString()).join(', ')}`,
    );
    return saved;
  }

  /** Times with a send due (the time itself or a reminder again), of reminders not done yet. */
  public async getDueReminders(now: Date = new Date()): Promise<DueReminderTime[]> {
    if (!this.timeRepo) return [];
    const rows = await this.timeRepo
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.reminder', 'reminder')
      .where(
        '((time.sent_at IS NULL AND time.remind_at <= :now) OR (time.nag_at IS NOT NULL AND time.nag_at <= :now))',
        { now },
      )
      .andWhere('reminder.is_triggered = false')
      .orderBy('time.remind_at', 'ASC')
      .take(DUE_REMINDER_BATCH)
      .getMany();
    return rows.filter((row): row is DueReminderTime => !!row.reminder);
  }

  /**
   * Claims what a time has due (`dueOccurrence`): the time itself (a one-off one is marked sent,
   * a repeating one moves to its next occurrence) or a reminder again. The update only matches
   * the state as read, so overlapping scans cannot both send it. Returns the claimed send, or
   * null when nothing was due or another scan claimed it first.
   */
  public async claimReminderTime(
    time: DueReminderTime,
    now: Date = new Date(),
  ): Promise<ReminderOccurrence | null> {
    if (!this.timeRepo) return null;
    const rule = timeRule(repeatOf(time), nagRuleOf(time.reminder));
    const occurrence = dueOccurrence(time, rule, now);
    if (!occurrence) return null;
    const where = occurrence.nag
      ? { id: time.id, nagAt: occurrence.at }
      : { id: time.id, sentAt: IsNull(), remindAt: time.remindAt };
    const result = await this.timeRepo.update(where, claimedState(time, rule, occurrence, now));
    return (result.affected ?? 0) > 0 ? occurrence : null;
  }

  /**
   * Gives a claimed send back (its delivery could not be queued or sent) so the next scan
   * retries it; a repeating time returns to the occurrence it had moved past.
   */
  public async releaseReminderTime(timeId: string, occurrence: ReminderOccurrence): Promise<void> {
    if (!this.timeRepo) return;
    await this.timeRepo.update({ id: timeId }, releasedState(occurrence));
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
    const times = await this.loadTimes([reminder.id]);
    const next = nextPendingReminderAt(times);
    const summary: Partial<ReminderEntity> = next
      ? { remindAt: next, isTriggered: false }
      : { isTriggered: true, status: 'completed', completedAt: new Date() };
    // Legacy column for older readers: the repeat of the earliest time.
    if (times[0]) summary.repeatType = repeatOf(times[0]).repeatType;
    if (next && reminder.status === 'completed') summary.status = 'pending';
    Object.assign(reminder, summary);
    await this.reminderRepo.update({ id: reminder.id }, summary);
  }

  /** Reminders of the user for one tab of `/reminders`. */
  public getUserReminders(
    userId: number | string,
    status: ReminderListStatus,
  ): Promise<ReminderEntity[]> {
    return status === 'done'
      ? this.getUserDoneReminders(userId)
      : this.getUserUpcomingReminders(userId);
  }

  /** Finished reminders (no time left, or marked done), latest first; kept until deleted. */
  public async getUserDoneReminders(userId: number | string): Promise<ReminderEntity[]> {
    return this.reminderRepo.find({
      where: { userId: userId.toString(), isTriggered: true },
      order: { completedAt: { direction: 'DESC', nulls: 'LAST' }, remindAt: 'DESC' },
      take: REMINDER_LIST_LIMITS.DONE_MAX,
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
    const current = await this.loadTimes([reminder.id]);
    const legacyRepeat: ReminderRepeat | undefined = input.repeatType
      ? { repeatType: input.repeatType, repeatWeekdays: [] }
      : undefined;
    let plan: ReminderTimesPlan<ReminderTimeEntity> | null = null;
    if (input.remindTimes !== undefined) {
      plan = this.planTimes(
        current,
        asRequestedTimes(input.remindTimes.map(validTime), legacyRepeat),
      );
      if (plan.keep.length + plan.add.length === 0) {
        throw new BadRequestException('Lời nhắc cần ít nhất một giờ nhắc.');
      }
    } else if (legacyRepeat) {
      // Older clients set one repeat for the whole reminder.
      plan = {
        keep: current,
        remove: [],
        add: [],
        repeatChanges: changesTo(current, legacyRepeat),
      };
    }
    const nagTouched = touchesNagRule(input);
    const nag = mergeNagRule(nagRuleOf(reminder), input);
    if (plan || nagTouched)
      this.checkRules(plan ? plannedRepeats(plan) : current.map(repeatOf), nag);
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
    let stopNag = false;
    if (nagTouched) {
      Object.assign(reminder, nagColumns(nag));
      stopNag = !hasNag(nag);
    }
    if (input.status !== undefined) {
      reminder.status = input.status;
      if (input.status === 'completed') {
        reminder.isTriggered = true;
        reminder.completedAt = new Date();
        stopNag = true;
      }
    }
    const saved = await this.reminderRepo.save(reminder);
    if (stopNag) await this.timeRepo?.update({ reminderId: saved.id }, NO_NAG_STATE);
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
    else {
      await this.applyTimes(reminder.id, {
        keep: [],
        remove: [],
        add: [{ at: newTime, repeat: NO_REPEAT }],
        repeatChanges: [],
      });
    }
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
    const saved = await this.reminderRepo.save(reminder);
    // Done means done: no reminder again goes out afterwards.
    await this.timeRepo?.update({ reminderId: saved.id }, NO_NAG_STATE);
    return saved;
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

  /** The rule after applying `input`, or a 400 with the reason. */
  /** The remind-again rule if it fits every time it applies to, else a 400 with the reason. */
  private checkRules(repeats: readonly ReminderRepeat[], nag: NagRule): NagRule {
    const error = checkReminderRules(repeats, nag);
    if (error) throw new BadRequestException(reminderRuleErrorMessage(error));
    return nag;
  }

  private planTimes(
    current: readonly ReminderTimeEntity[],
    requested: readonly RequestedReminderTime[],
  ) {
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
        plan.add.map((time) =>
          repo.create({
            reminderId,
            remindAt: time.at,
            sentAt: null,
            repeatType: time.repeat.repeatType,
            repeatWeekdays: [...time.repeat.repeatWeekdays],
          }),
        ),
      );
    }
    for (const change of plan.repeatChanges) {
      await repo.update({ id: change.time.id }, repeatChangeState(change.time, change.repeat));
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

function nagColumns(nag: NagRule): Pick<ReminderEntity, 'nagEveryMinutes' | 'nagCount'> {
  return { nagEveryMinutes: nag.nagEveryMinutes, nagCount: nag.nagCount };
}

/** A valid time from a date or a requested time (pending actions carry ISO strings). */
function validTime(value: Date | RequestedReminderTime): RequestedReminderTime {
  return value instanceof Date || typeof value === 'string'
    ? { at: toValidReminderDate(value) }
    : { ...value, at: toValidReminderDate(value.at) };
}

/** Repeat changes that give every time `repeat`. */
function changesTo<T extends ReminderTimeEntity>(
  times: readonly T[],
  repeat: ReminderRepeat,
): Array<{ time: T; repeat: ReminderRepeat }> {
  return times
    .filter((time) => !isSameRepeat(repeatOf(time), repeat))
    .map((time) => ({ time, repeat }));
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
