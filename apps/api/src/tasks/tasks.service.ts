import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  IReminderTargetUser,
  ITaskListItem,
  ReminderTargetMode,
  TaskSource,
  TaskStatus,
} from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { TaskReminderTimeEntity } from '../database/entities/task-reminder-time.entity';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { loadRecordOriginLookups } from '../google/google-copy.util';
import type { ReminderTarget } from '../reminders/reminder-target';
import {
  NO_NAG_RULE,
  NO_NAG_STATE,
  type NagRule,
  type NagRuleInput,
  type ReminderOccurrence,
  type ReminderRepeat,
  checkReminderRules,
  claimedState,
  dueOccurrence,
  hasNag,
  mergeNagRule,
  nagRuleOf,
  nextOccurrence,
  releasedState,
  reminderRuleErrorMessage,
  repeatChangeState,
  repeatOf,
  timeRule,
  touchesNagRule,
} from '../reminders/reminder-schedule';
import { ReminderTargetService } from '../reminders/reminder-target.service';
import {
  type ReminderTimesPlan,
  type RequestedReminderTime,
  asRequestedTimes,
  lastSentReminderAt,
  nextPendingReminderAt,
  planReminderTimes,
  plannedRepeats,
  reminderTimesErrorMessage,
} from '../reminders/reminder-times';
import { type TaskFields, UNTITLED_TASK, toTaskItem } from './task.mapper';
import { arePotentialDuplicateTaskTitles } from './task-title.util';

/** Who is acting; recorded on the task for display only. */
export interface TaskActor {
  userId?: string;
  name?: string;
  chatId?: string;
  source: TaskSource;
}

export interface TaskInput extends NagRuleInput {
  title: string;
  notes?: string | null;
  dueAt?: Date | null;
  status?: TaskStatus;
  /** Replaces the reminder times; `null` or `[]` removes every reminder (and the target). */
  remindTimes?: readonly (Date | RequestedReminderTime)[] | null;
  /** Defaults to the actor's chat: the chat the bot was asked in, else the user's private chat. */
  remindChatId?: string | null;
  /** Dashboard picks among the reminder group's members; `[]` clears them. */
  remindUserIds?: readonly string[];
  /** People tagged in a bot message (already real Zalo users). */
  remindUsers?: readonly IReminderTargetUser[];
  remindMode?: ReminderTargetMode;
}

/** Target columns of a task row. */
type TaskTargetColumns = Pick<TaskEntity, 'remindChatId' | 'remindUsers' | 'remindMode'>;

const NO_TARGET: TaskTargetColumns = { remindChatId: null, remindUsers: [], remindMode: 'mention' };

export type TaskPatch = Partial<TaskInput>;

export interface TaskListOptions {
  status?: TaskStatus;
  query?: string;
  limit?: number;
}

export interface TaskDuplicateWarning {
  requestedTitle: string;
  matches: Array<{ id: string; title: string; notes?: string | null }>;
}

/** A reminder time that is due, with its task. */
export type DueTaskReminder = TaskReminderTimeEntity & { task: TaskEntity };

/** Due reminder times handled per scheduler tick. */
const DUE_REMINDER_BATCH = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The system task list. Tasks live only in `tasks` (shared by everyone, like the finance
 * ledger); they are not copied to Google Tasks, so no Google connection is needed. A task can
 * remind several times (`task_reminder_times`); `tasks.remind_at` is the next time not sent.
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadConfigRepo?: Repository<ZcaThreadConfigEntity>,
    @Optional()
    @Inject(forwardRef(() => ReminderTargetService))
    private readonly targets?: ReminderTargetService,
    @Optional()
    @InjectRepository(TaskReminderTimeEntity)
    private readonly timeRepo?: Repository<TaskReminderTimeEntity>,
  ) {}

  /** Open tasks first (nearest due date first), then completed ones. */
  public async listTasks(options: TaskListOptions = {}): Promise<TaskEntity[]> {
    const qb = this.taskRepo.createQueryBuilder('task').where('task.deleted_at IS NULL');
    if (options.status) qb.andWhere('task.status = :status', { status: options.status });
    const query = options.query?.trim();
    if (query) {
      qb.andWhere('(task.title ILIKE :q OR task.notes ILIKE :q)', {
        q: `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      });
    }
    return (
      qb
        // 'needsAction' sorts after 'completed', so DESC puts open tasks first.
        .orderBy('task.status', 'DESC')
        .addOrderBy('task.due_at', 'ASC', 'NULLS LAST')
        .addOrderBy('task.created_at', 'DESC')
        .take(options.limit ?? 500)
        .getMany()
    );
  }

  public async getTask(id: string): Promise<TaskEntity> {
    const row = UUID_PATTERN.test(id)
      ? await this.taskRepo.findOne({ where: { id, deletedAt: IsNull() } })
      : null;
    if (!row) throw new NotFoundException('Không tìm thấy việc cần làm.');
    return row;
  }

  public async createTask(input: TaskInput, actor: TaskActor): Promise<TaskEntity> {
    const fields = this.normalize(input);
    // Validate the reminder before saving, so a bad value never leaves a saved task behind.
    const plan = this.planTimes([], input.remindTimes ?? []);
    const times = plan.add;
    const nag = this.checkRules(plannedRepeats(plan), mergeNagRule(NO_NAG_RULE, input));
    const target = times.length > 0 ? await this.resolveTarget(input, null, actor) : null;
    const row = await this.taskRepo.save(
      this.taskRepo.create({
        ...fields,
        ...nagColumns(nag),
        ...targetColumns(target),
        remindAt: times[0]?.at ?? null,
        remindedAt: null,
        createdByUserId: actor.userId ?? null,
        createdByName: actor.name?.trim() || null,
        source: actor.source,
        sourceChatId: actor.chatId ?? null,
      }),
    );
    await this.applyTimes(row.id, plan);
    return row;
  }

  /**
   * `actor` is who edits; it gives the default reminder chat and the chats they may pick.
   * Changing the target only affects times not sent yet: sent times are never re-sent.
   */
  public async updateTask(
    id: string,
    patch: TaskPatch,
    actor?: Pick<TaskActor, 'userId' | 'chatId'>,
  ): Promise<TaskEntity> {
    const row = await this.getTask(id);
    const status = patch.status ?? row.status;
    const merged = this.normalize({
      title: patch.title ?? row.title,
      notes: patch.notes !== undefined ? patch.notes : row.notes,
      dueAt: patch.dueAt !== undefined ? patch.dueAt : row.dueAt,
      status,
    });
    // Keep the original completion time unless the task was re-opened or just completed.
    if (status === 'completed' && row.status === 'completed' && row.completedAt) {
      merged.completedAt = row.completedAt;
    }
    const reopened = row.status === 'completed' && status === 'needsAction';
    const completed = row.status !== 'completed' && status === 'completed';
    const nagTouched = touchesNagRule(patch);
    const nag = mergeNagRule(nagRuleOf(row), patch);
    if (nagTouched) Object.assign(row, nagColumns(nag));
    // Done means done: reminding again stops, as it does when the rule turns it off.
    const stopNag = completed || (nagTouched && !hasNag(nag));
    const timesTouched = patch.remindTimes !== undefined;
    const targetTouched =
      patch.remindChatId !== undefined ||
      patch.remindUserIds !== undefined ||
      patch.remindUsers !== undefined ||
      patch.remindMode !== undefined;

    // Edits that leave the reminder alone keep it as is (and need no lookups).
    if (!timesTouched && !targetTouched && !reopened) {
      if (nagTouched) this.checkRules((await this.loadTimes([row.id])).map(repeatOf), nag);
      Object.assign(row, merged);
      const saved = await this.taskRepo.save(row);
      if (stopNag) {
        await this.timeRepo?.update({ taskId: row.id }, NO_NAG_STATE);
        await this.refreshReminderSummary(saved);
      }
      return saved;
    }

    const current = await this.loadTimes([row.id]);
    const plan: ReminderTimesPlan<TaskReminderTimeEntity> = timesTouched
      ? this.planTimes(current, patch.remindTimes ?? [])
      : { keep: current, remove: [], add: [], repeatChanges: [] };
    this.checkRules(plannedRepeats(plan), nag);
    const hasTimes = plan.keep.length + plan.add.length > 0;
    const currentTarget = taskReminderTarget(row);
    let target: ReminderTarget | null = null;
    if (hasTimes) {
      target =
        targetTouched || !currentTarget
          ? await this.resolveTarget(patch, currentTarget, actor ?? {})
          : currentTarget;
    }

    Object.assign(row, merged, targetColumns(target));
    await this.taskRepo.save(row);
    await this.applyTimes(row.id, plan);
    if (stopNag) await this.timeRepo?.update({ taskId: row.id }, NO_NAG_STATE);
    if (reopened) await this.skipMissedTimes(row);
    await this.refreshReminderSummary(row);
    return row;
  }

  public completeTask(id: string): Promise<TaskEntity> {
    return this.updateTask(id, { status: 'completed' });
  }

  /** Soft delete, so the audit log and history keep pointing at a real row. */
  public async deleteTask(id: string): Promise<TaskEntity> {
    const row = await this.getTask(id);
    row.deletedAt = new Date();
    return this.taskRepo.save(row);
  }

  /** Open tasks whose titles look like the requested ones (see `arePotentialDuplicateTaskTitles`). */
  public async findPotentialDuplicateTasks(
    requestedTitles: readonly string[],
  ): Promise<TaskDuplicateWarning[]> {
    const open = await this.listTasks({ status: 'needsAction', limit: 200 });
    return requestedTitles.flatMap((requestedTitle) => {
      const title = requestedTitle.trim();
      if (!title) return [];
      const matches = open
        .filter((task) => arePotentialDuplicateTaskTitles(title, task.title))
        .map((task) => ({ id: task.id, title: task.title, notes: task.notes }));
      return matches.length > 0 ? [{ requestedTitle: title, matches }] : [];
    });
  }

  /** DTOs with creator names, source chat names, reminder chat names and reminder times. */
  public async toItems(rows: readonly TaskEntity[]): Promise<ITaskListItem[]> {
    // A reminder chat is a thread (named in `zca_thread_configs`) or a private chat (a user).
    const remindChats = rows.flatMap((row) =>
      row.remindChatId
        ? [{ createdByUserId: row.remindChatId, sourceChatId: row.remindChatId }]
        : [],
    );
    const [lookups, times] = await Promise.all([
      loadRecordOriginLookups([...rows, ...remindChats], {
        userRepo: this.userRepo,
        threadConfigRepo: this.threadConfigRepo,
      }),
      this.loadTimes(rows.map((row) => row.id)),
    ]);
    return rows.map((row) =>
      toTaskItem(
        row,
        lookups,
        times.filter((time) => time.taskId === row.id),
      ),
    );
  }

  /** Times with a send due (the time or a reminder again), of open tasks with a reminder chat. */
  public async getDueTaskReminders(now: Date = new Date()): Promise<DueTaskReminder[]> {
    if (!this.timeRepo) return [];
    const rows = await this.timeRepo
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.task', 'task')
      .where(
        '((time.sent_at IS NULL AND time.remind_at <= :now) OR (time.nag_at IS NOT NULL AND time.nag_at <= :now))',
        { now },
      )
      .andWhere('task.deleted_at IS NULL')
      .andWhere('task.status = :status', { status: 'needsAction' })
      .andWhere('task.remind_chat_id IS NOT NULL')
      .orderBy('time.remind_at', 'ASC')
      .take(DUE_REMINDER_BATCH)
      .getMany();
    return rows.filter((row): row is DueTaskReminder => !!row.task);
  }

  /**
   * Claims what a time has due (`dueOccurrence`): the time itself (sent once, or moved to its
   * next occurrence when the task repeats) or a reminder again. Only the first caller wins, so
   * two overlapping scans cannot both send it; returns the claimed send, or null.
   */
  public async claimTaskReminderTime(
    time: DueTaskReminder,
    now: Date = new Date(),
  ): Promise<ReminderOccurrence | null> {
    if (!this.timeRepo) return null;
    const rule = timeRule(repeatOf(time), nagRuleOf(time.task));
    const occurrence = dueOccurrence(time, rule, now);
    if (!occurrence) return null;
    const where = occurrence.nag
      ? { id: time.id, nagAt: occurrence.at }
      : { id: time.id, sentAt: IsNull(), remindAt: time.remindAt };
    const result = await this.timeRepo.update(where, claimedState(time, rule, occurrence, now));
    return (result.affected ?? 0) > 0 ? occurrence : null;
  }

  /** Gives a claimed send back (it could not be queued or sent), so the next scan retries it. */
  public async releaseTaskReminderTime(
    timeId: string,
    occurrence: ReminderOccurrence,
  ): Promise<void> {
    if (!this.timeRepo) return;
    await this.timeRepo.update({ id: timeId }, releasedState(occurrence));
  }

  /** One reminder time with its task (deleted tasks included, so callers can skip them). */
  public async getTaskReminderTime(timeId: string): Promise<DueTaskReminder | null> {
    if (!this.timeRepo) return null;
    const row = await this.timeRepo.findOne({ where: { id: timeId }, relations: { task: true } });
    return row?.task ? { ...row, task: row.task } : null;
  }

  /** Recomputes `remind_at` (next time not sent) and `reminded_at` (last sent) of a task. */
  public async refreshReminderSummary(row: TaskEntity): Promise<void> {
    const times = await this.loadTimes([row.id]);
    const remindAt = nextPendingReminderAt(times);
    const remindedAt = lastSentReminderAt(times);
    row.remindAt = remindAt;
    row.remindedAt = remindedAt;
    // A task without any time left keeps no target either.
    if (times.length === 0) Object.assign(row, NO_TARGET);
    await this.taskRepo.update(
      { id: row.id },
      { remindAt, remindedAt, ...(times.length === 0 ? NO_TARGET : {}) },
    );
  }

  /**
   * Re-opening a done task: times that passed meanwhile are not sent all at once. A one-off
   * time is marked handled; a repeating one moves to its next occurrence after now.
   */
  private async skipMissedTimes(row: TaskEntity, now: Date = new Date()): Promise<void> {
    const repo = this.timeRepo;
    if (!repo) return;
    const missed = (await this.loadTimes([row.id])).filter(
      (time) => !time.sentAt && time.remindAt.getTime() < now.getTime(),
    );
    for (const time of missed) {
      const anchor = time.anchorAt ?? time.remindAt;
      const next = nextOccurrence(time.remindAt, anchor, repeatOf(time), now);
      await repo.update(
        { id: time.id },
        next ? { remindAt: next, anchorAt: anchor } : { sentAt: now },
      );
    }
  }

  /** The remind-again rule if it fits every time it applies to, else a 400 with the reason. */
  private checkRules(repeats: readonly ReminderRepeat[], nag: NagRule): NagRule {
    const error = checkReminderRules(repeats, nag);
    if (error) throw new BadRequestException(reminderRuleErrorMessage(error));
    return nag;
  }

  private async loadTimes(taskIds: readonly string[]): Promise<TaskReminderTimeEntity[]> {
    if (!this.timeRepo || taskIds.length === 0) return [];
    return this.timeRepo.find({
      where: { taskId: In([...taskIds]) },
      order: { remindAt: 'ASC' },
    });
  }

  /** Removes, adds and re-repeats times as planned. */
  private async applyTimes(
    taskId: string,
    plan: ReminderTimesPlan<TaskReminderTimeEntity>,
  ): Promise<void> {
    const repo = this.timeRepo;
    if (plan.remove.length + plan.add.length + plan.repeatChanges.length === 0) return;
    if (!repo) throw new Error('Bảng giờ nhắc việc chưa được cấu hình.');
    if (plan.remove.length > 0) await repo.delete(plan.remove.map((time) => time.id));
    if (plan.add.length > 0) {
      await repo.save(
        plan.add.map((time) =>
          repo.create({
            taskId,
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

  private planTimes(
    current: readonly TaskReminderTimeEntity[],
    requested: readonly (Date | RequestedReminderTime)[],
  ) {
    const result = planReminderTimes(current, asRequestedTimes(requested));
    if ('error' in result) throw new BadRequestException(reminderTimesErrorMessage(result.error));
    return result.plan;
  }

  /**
   * The target via `ReminderTargetService`, defaulting to the chat the bot was asked in, else
   * the user's private chat.
   */
  private resolveTarget(
    input: TaskPatch,
    current: ReminderTarget | null,
    actor: Pick<TaskActor, 'userId' | 'chatId'>,
  ): Promise<ReminderTarget> {
    if (!this.targets) throw new Error('ReminderTargetService chưa được cấu hình.');
    return this.targets.resolve(
      {
        chatId: input.remindChatId,
        userIds: input.remindUserIds,
        users: input.remindUsers,
        mode: input.remindMode,
      },
      current,
      actor,
      'origin',
    );
  }

  private normalize(input: TaskInput): TaskFields {
    const status = input.status ?? 'needsAction';
    return {
      title: input.title.trim() || UNTITLED_TASK,
      notes: input.notes?.trim() || null,
      dueAt: input.dueAt ?? null,
      status,
      completedAt: status === 'completed' ? new Date() : null,
    };
  }
}

/** The current target of a task's reminder, or null when it has none. */
function taskReminderTarget(row: TaskTargetColumns): ReminderTarget | null {
  if (!row.remindChatId) return null;
  return {
    chatId: row.remindChatId,
    users: row.remindUsers ?? [],
    mode: row.remindMode ?? 'mention',
  };
}

function nagColumns(nag: NagRule): Pick<TaskEntity, 'nagEveryMinutes' | 'nagCount'> {
  return { nagEveryMinutes: nag.nagEveryMinutes, nagCount: nag.nagCount };
}

function targetColumns(target: ReminderTarget | null): TaskTargetColumns {
  if (!target) return NO_TARGET;
  return { remindChatId: target.chatId, remindUsers: target.users, remindMode: target.mode };
}
