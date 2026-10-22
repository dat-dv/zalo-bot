import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ITaskListItem,
  ITaskReminderChannel,
  TaskSource,
  TaskStatus,
} from '@zalobot/contracts';
import { IsNull, Not, Repository } from 'typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { loadRecordOriginLookups } from '../google/google-copy.util';
import { DASHBOARD_OWNER_USER_ID } from '../users/dashboard-owner';
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
}

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
    const remind = await this.resolveReminder(
      { remindAt: fields.remindAt, remindChatId: input.remindChatId },
      null,
      actor,
    );
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
    const remind = await this.resolveReminder(
      { remindAt: merged.remindAt, remindChatId: patch.remindChatId },
      row,
      actor ?? {},
    );
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

  /**
   * Chats the dashboard user may send a task reminder to: their own private chat (when they
   * have a Zalo account), then every listened thread.
   */
  public async listReminderChannels(userId: string): Promise<ITaskReminderChannel[]> {
    const selfId = hasZaloAccount(userId) ? userId : undefined;
    const [threads, self] = await Promise.all([
      this.threadConfigRepo
        ? this.threadConfigRepo.find({
            where: { isListened: true },
            select: { threadId: true, threadName: true, threadType: true },
            order: { threadName: 'ASC' },
          })
        : Promise.resolve<ZcaThreadConfigEntity[]>([]),
      selfId && this.userRepo
        ? this.userRepo.findOne({ where: { id: selfId }, select: { id: true, firstName: true } })
        : Promise.resolve<UserEntity | null>(null),
    ]);
    const channels: ITaskReminderChannel[] = selfId
      ? [{ id: selfId, name: self?.firstName?.trim() || selfId, type: 'user', isSelf: true }]
      : [];
    for (const thread of threads) {
      if (thread.threadId === selfId) continue;
      channels.push({
        id: thread.threadId,
        name: thread.threadName?.trim() || thread.threadId,
        type: thread.threadType === 'group' ? 'group' : 'user',
      });
    }
    return channels;
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

  /** Whether the bot listens to the thread, so it may be picked as a reminder chat. */
  public async isListenedThread(chatId: string): Promise<boolean> {
    if (!this.threadConfigRepo) return false;
    return (
      (await this.threadConfigRepo.count({ where: { threadId: chatId, isListened: true } })) > 0
    );
  }

  /**
   * A group the admin stopped listening to: the bot no longer posts there. Private chats are
   * always messaged, like personal reminders.
   */
  public async isUnlistenedGroup(chatId: string): Promise<boolean> {
    if (!this.threadConfigRepo) return false;
    const count = await this.threadConfigRepo.count({
      where: { threadId: chatId, threadType: 'group', isListened: false },
    });
    return count > 0;
  }

  /**
   * Reminder columns for a create (`row` = null) or an update. A reminder needs a chat: the one
   * asked for, the one already set, or the actor's default. A newly chosen chat must be the
   * actor's own chat or a listened thread, and a new time must be in the future. Changing the
   * time or chat re-arms a reminder that already went out.
   */
  private async resolveReminder(
    input: { remindAt: Date | null; remindChatId?: string | null },
    row: Pick<TaskEntity, 'remindAt' | 'remindChatId' | 'remindedAt'> | null,
    actor: Pick<TaskActor, 'userId' | 'chatId'>,
  ): Promise<Pick<TaskEntity, 'remindAt' | 'remindChatId' | 'remindedAt'>> {
    const { remindAt } = input;
    if (!remindAt) return { remindAt: null, remindChatId: null, remindedAt: null };

    const ownChat = defaultReminderChatId(actor);
    const remindChatId = input.remindChatId?.trim() || row?.remindChatId || ownChat || null;
    if (!remindChatId) {
      throw new BadRequestException('Chọn kênh Zalo nhận nhắc.');
    }
    const chatChanged = remindChatId !== row?.remindChatId;
    const timeChanged = remindAt.getTime() !== row?.remindAt?.getTime();
    if (chatChanged && remindChatId !== ownChat && !(await this.isListenedThread(remindChatId))) {
      throw new BadRequestException('Kênh nhận nhắc phải là kênh Zalo đang được listen.');
    }
    if (timeChanged && remindAt.getTime() < Date.now() - REMINDER_PAST_TOLERANCE_MS) {
      throw new BadRequestException('Thời điểm nhắc phải ở tương lai.');
    }
    return {
      remindAt,
      remindChatId,
      remindedAt: chatChanged || timeChanged ? null : (row?.remindedAt ?? null),
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

/** `dashboard-owner` signs in with the fixed code and has no Zalo account to message. */
function hasZaloAccount(userId: string | undefined): userId is string {
  return !!userId && userId !== DASHBOARD_OWNER_USER_ID;
}

/** The chat a reminder goes to by default: where the bot was asked, else the user's own chat. */
function defaultReminderChatId(actor: Pick<TaskActor, 'userId' | 'chatId'>): string | undefined {
  return actor.chatId || (hasZaloAccount(actor.userId) ? actor.userId : undefined);
}
