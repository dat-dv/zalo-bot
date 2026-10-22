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
import { IsNull, Not, Repository } from 'typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { loadRecordOriginLookups } from '../google/google-copy.util';
import { type ReminderTarget, isSameTarget } from '../reminders/reminder-target';
import { ReminderTargetService } from '../reminders/reminder-target.service';
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
  /** `null` clears the reminder (and its chat). */
  remindAt?: Date | null;
  /** Defaults to the actor's chat: the chat the bot was asked in, else the user's private chat. */
  remindChatId?: string | null;
  /** Dashboard picks among the reminder group's members; `[]` clears them. */
  remindUserIds?: readonly string[];
  /** People tagged in a bot message (already real Zalo users). */
  remindUsers?: readonly IReminderTargetUser[];
  remindMode?: ReminderTargetMode;
}

/** Reminder columns of a task row. */
type TaskReminderColumns = Pick<
  TaskEntity,
  'remindAt' | 'remindChatId' | 'remindUsers' | 'remindMode' | 'remindedAt'
>;

const NO_REMINDER: TaskReminderColumns = {
  remindAt: null,
  remindChatId: null,
  remindUsers: [],
  remindMode: 'mention',
  remindedAt: null,
};

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

/** Due reminders handled per scheduler tick. */
const DUE_REMINDER_BATCH = 50;

/** The dashboard picks reminder times by the minute, so the current minute is not "past". */
const REMINDER_PAST_TOLERANCE_MS = 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The system task list. Tasks live only in `tasks` (shared by everyone, like the finance
 * ledger); they are not copied to Google Tasks, so no Google connection is needed.
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
    const remind = await this.resolveReminder({ ...input, remindAt: fields.remindAt }, null, actor);
    const row = this.taskRepo.create({
      ...fields,
      ...remind,
      createdByUserId: actor.userId ?? null,
      createdByName: actor.name?.trim() || null,
      source: actor.source,
      sourceChatId: actor.chatId ?? null,
    });
    return this.taskRepo.save(row);
  }

  /** `actor` is who edits; it gives the default reminder chat and the chats they may pick. */
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
      remindAt: patch.remindAt !== undefined ? patch.remindAt : row.remindAt,
    });
    // Keep the original completion time unless the task was re-opened or just completed.
    if (status === 'completed' && row.status === 'completed' && row.completedAt) {
      merged.completedAt = row.completedAt;
    }
    // Edits that leave the reminder alone keep it as is (and need no chat lookups).
    const touchesReminder =
      patch.remindAt !== undefined ||
      patch.remindChatId !== undefined ||
      patch.remindUserIds !== undefined ||
      patch.remindUsers !== undefined ||
      patch.remindMode !== undefined;
    const remind = touchesReminder
      ? await this.resolveReminder({ ...patch, remindAt: merged.remindAt }, row, actor ?? {})
      : {};
    Object.assign(row, merged, remind);
    return this.taskRepo.save(row);
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

  /** DTOs with creator names, source chat names and reminder chat names. */
  public async toItems(rows: readonly TaskEntity[]): Promise<ITaskListItem[]> {
    // A reminder chat is a thread (named in `zca_thread_configs`) or a private chat (a user).
    const remindChats = rows.flatMap((row) =>
      row.remindChatId
        ? [{ createdByUserId: row.remindChatId, sourceChatId: row.remindChatId }]
        : [],
    );
    const lookups = await loadRecordOriginLookups([...rows, ...remindChats], {
      userRepo: this.userRepo,
      threadConfigRepo: this.threadConfigRepo,
    });
    return rows.map((row) => toTaskItem(row, lookups));
  }

  /** Open tasks whose reminder time has come and that were not reminded yet. */
  public getDueTaskReminders(now: Date = new Date()): Promise<TaskEntity[]> {
    return this.taskRepo
      .createQueryBuilder('task')
      .where('task.deleted_at IS NULL')
      .andWhere('task.status = :status', { status: 'needsAction' })
      .andWhere('task.remind_at <= :now', { now })
      .andWhere('task.reminded_at IS NULL')
      .andWhere('task.remind_chat_id IS NOT NULL')
      .orderBy('task.remind_at', 'ASC')
      .take(DUE_REMINDER_BATCH)
      .getMany();
  }

  /**
   * Marks the reminder done. Only the first caller wins, so two overlapping scheduler ticks
   * cannot both send it; returns whether this call marked it.
   */
  public async markTaskReminded(id: string, at: Date = new Date()): Promise<boolean> {
    const result = await this.taskRepo.update(
      { id, remindedAt: IsNull(), remindAt: Not(IsNull()) },
      { remindedAt: at },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Reminder columns for a create (`row` = null) or an update. The target (chat, people, how)
   * comes from `ReminderTargetService`, defaulting to the chat the bot was asked in, else the
   * user's private chat. A new time must be in the future. Changing the time or the target
   * re-arms a reminder that already went out.
   */
  private async resolveReminder(
    input: Omit<TaskInput, 'title'> & { remindAt: Date | null },
    row: TaskReminderColumns | null,
    actor: Pick<TaskActor, 'userId' | 'chatId'>,
  ): Promise<TaskReminderColumns> {
    const { remindAt } = input;
    if (!remindAt) return NO_REMINDER;
    if (!this.targets) throw new Error('ReminderTargetService chưa được cấu hình.');

    const current = taskReminderTarget(row);
    const target = await this.targets.resolve(
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
    const timeChanged = remindAt.getTime() !== row?.remindAt?.getTime();
    if (timeChanged && remindAt.getTime() < Date.now() - REMINDER_PAST_TOLERANCE_MS) {
      throw new BadRequestException('Thời điểm nhắc phải ở tương lai.');
    }
    const rearm = timeChanged || !isSameTarget(current, target);
    return {
      remindAt,
      remindChatId: target.chatId,
      remindUsers: target.users,
      remindMode: target.mode,
      remindedAt: rearm ? null : (row?.remindedAt ?? null),
    };
  }

  private normalize(input: TaskInput): TaskFields {
    const status = input.status ?? 'needsAction';
    return {
      title: input.title.trim() || UNTITLED_TASK,
      notes: input.notes?.trim() || null,
      dueAt: input.dueAt ?? null,
      status,
      completedAt: status === 'completed' ? new Date() : null,
      remindAt: input.remindAt ?? null,
    };
  }
}

/** The current target of a task's reminder, or null when it has none. */
function taskReminderTarget(row: TaskReminderColumns | null): ReminderTarget | null {
  if (!row?.remindChatId) return null;
  return {
    chatId: row.remindChatId,
    users: row.remindUsers ?? [],
    mode: row.remindMode ?? 'mention',
  };
}
