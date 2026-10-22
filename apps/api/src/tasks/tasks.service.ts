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
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { TaskReminderTimeEntity } from '../database/entities/task-reminder-time.entity';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { loadRecordOriginLookups } from '../google/google-copy.util';
import type { ReminderTarget } from '../reminders/reminder-target';
import { ReminderTargetService } from '../reminders/reminder-target.service';
import {
  lastSentReminderAt,
  nextPendingReminderAt,
  planReminderTimes,
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

export interface TaskInput {
  title: string;
  notes?: string | null;
  dueAt?: Date | null;
  status?: TaskStatus;
  /** Replaces the reminder times; `null` or `[]` removes every reminder (and the target). */
  remindTimes?: readonly Date[] | null;
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
    const times = this.planTimes([], input.remindTimes ?? []).add;
    const target = times.length > 0 ? await this.resolveTarget(input, null, actor) : null;
    const row = await this.taskRepo.save(
      this.taskRepo.create({
        ...fields,
        ...targetColumns(target),
        remindAt: times[0] ?? null,
        remindedAt: null,
        createdByUserId: actor.userId ?? null,
        createdByName: actor.name?.trim() || null,
        source: actor.source,
        sourceChatId: actor.chatId ?? null,
      }),
    );
    if (times.length > 0) await this.insertTimes(row.id, times);
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
    const timesTouched = patch.remindTimes !== undefined;
    const targetTouched =
      patch.remindChatId !== undefined ||
      patch.remindUserIds !== undefined ||
      patch.remindUsers !== undefined ||
      patch.remindMode !== undefined;

    // Edits that leave the reminder alone keep it as is (and need no lookups).
    if (!timesTouched && !targetTouched && !reopened) {
      Object.assign(row, merged);
      return this.taskRepo.save(row);
    }

    const current = await this.loadTimes([row.id]);
    const plan = timesTouched
      ? this.planTimes(current, patch.remindTimes ?? [])
      : { keep: current, remove: [], add: [] };
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
    if (plan.remove.length > 0) await this.timeRepo?.delete(plan.remove.map((time) => time.id));
    if (plan.add.length > 0) await this.insertTimes(row.id, plan.add);
    if (reopened) {
      // Times that passed while the task was done are skipped, not sent all at once.
      await this.timeRepo?.update(
        { taskId: row.id, sentAt: IsNull(), remindAt: LessThan(new Date()) },
        { sentAt: new Date() },
      );
    }
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

  /** Reminder times that are due, of open tasks with a reminder chat, oldest first. */
  public async getDueTaskReminders(now: Date = new Date()): Promise<DueTaskReminder[]> {
    if (!this.timeRepo) return [];
    const rows = await this.timeRepo
      .createQueryBuilder('time')
      .innerJoinAndSelect('time.task', 'task')
      .where('time.sent_at IS NULL')
      .andWhere('time.remind_at <= :now', { now })
      .andWhere('task.deleted_at IS NULL')
      .andWhere('task.status = :status', { status: 'needsAction' })
      .andWhere('task.remind_chat_id IS NOT NULL')
      .orderBy('time.remind_at', 'ASC')
      .take(DUE_REMINDER_BATCH)
      .getMany();
    return rows.filter((row): row is DueTaskReminder => !!row.task);
  }

  /**
   * Marks one reminder time sent. Only the first caller wins, so two overlapping scheduler
   * ticks cannot both send it; returns whether this call marked it.
   */
  public async markTaskReminderSent(timeId: string, at: Date = new Date()): Promise<boolean> {
    if (!this.timeRepo) return false;
    const result = await this.timeRepo.update({ id: timeId, sentAt: IsNull() }, { sentAt: at });
    return (result.affected ?? 0) > 0;
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

  private async loadTimes(taskIds: readonly string[]): Promise<TaskReminderTimeEntity[]> {
    if (!this.timeRepo || taskIds.length === 0) return [];
    return this.timeRepo.find({
      where: { taskId: In([...taskIds]) },
      order: { remindAt: 'ASC' },
    });
  }

  private async insertTimes(taskId: string, times: readonly Date[]): Promise<void> {
    const repo = this.timeRepo;
    if (!repo) throw new Error('Bảng giờ nhắc việc chưa được cấu hình.');
    await repo.save(times.map((remindAt) => repo.create({ taskId, remindAt, sentAt: null })));
  }

  private planTimes(current: readonly TaskReminderTimeEntity[], requested: readonly Date[]) {
    const result = planReminderTimes(current, requested);
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

function targetColumns(target: ReminderTarget | null): TaskTargetColumns {
  if (!target) return NO_TARGET;
  return { remindChatId: target.chatId, remindUsers: target.users, remindMode: target.mode };
}
