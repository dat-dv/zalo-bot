import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITaskListItem, TaskSource, TaskStatus } from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { GoogleAuthService } from '../google/google-auth.service';
import {
  errorMessage,
  googleErrorStatus,
  loadRecordOriginLookups,
  resolveGoogleCopyTarget,
} from '../google/google-copy.util';
import { GoogleTasksService } from '../google/google-tasks.service';
import {
  type TaskFields,
  UNTITLED_TASK,
  differsFromRow,
  fromGoogleTask,
  toGoogleTaskBody,
  toTaskItem,
} from './task.mapper';
import { arePotentialDuplicateTaskTitles } from './task-title.util';

/** Who is acting; `userId` also picks the Google account (own token, else the shared one). */
export interface TaskActor {
  userId?: string;
  name?: string;
  chatId?: string;
  source: Exclude<TaskSource, 'google'>;
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  dueAt?: Date | null;
  status?: TaskStatus;
}

export type TaskPatch = Partial<TaskInput>;

export interface TaskListOptions {
  status?: TaskStatus;
  query?: string;
  limit?: number;
  /** Import this viewer's Google account into the DB first (throttled). */
  importForUserId?: string;
}

export interface TaskDuplicateWarning {
  requestedTitle: string;
  matches: Array<{ id: string; title: string; notes?: string | null }>;
}

// Re-reading the whole Google account more often than this only costs API quota.
const IMPORT_THROTTLE_MS = 5 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIST = '@default';

/**
 * The system task list. Tasks live in `tasks` (shared by everyone, like the calendar and the
 * finance ledger); Google Tasks keeps a copy in whichever account was connected when the task
 * was written. Reads come from the DB, after importing the viewer's Google account so tasks
 * made directly in Google show up and stay once seen.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly recentImports = new Map<string, number>();
  private readonly runningImports = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly google: GoogleTasksService,
    private readonly googleAuth: GoogleAuthService,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadConfigRepo?: Repository<ZcaThreadConfigEntity>,
  ) {}

  /** Open tasks first (nearest due date first), then completed ones. */
  public async listTasks(options: TaskListOptions = {}): Promise<TaskEntity[]> {
    if (options.importForUserId !== undefined) {
      await this.importFromGoogle(options.importForUserId);
    }
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

  /** By row id; also accepts a Google task id (bot actions queued before the DB move). */
  public async getTask(id: string): Promise<TaskEntity> {
    const row = UUID_PATTERN.test(id)
      ? await this.taskRepo.findOne({ where: { id, deletedAt: IsNull() } })
      : await this.taskRepo.findOne({ where: { googleTaskId: id, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException('Không tìm thấy việc cần làm.');
    return row;
  }

  public async createTask(input: TaskInput, actor: TaskActor): Promise<TaskEntity> {
    const row = this.taskRepo.create({
      ...this.normalize(input),
      createdByUserId: actor.userId ?? null,
      createdByName: actor.name?.trim() || null,
      source: actor.source,
      sourceChatId: actor.chatId ?? null,
      syncStatus: this.googleAuth.isAuthorized(actor.userId) ? 'pending' : 'local',
    });
    const saved = await this.taskRepo.save(row);
    return this.pushToGoogle(saved, actor.userId);
  }

  public async updateTask(id: string, patch: TaskPatch, actorId?: string): Promise<TaskEntity> {
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
    Object.assign(row, merged);
    const saved = await this.taskRepo.save(row);
    return this.pushToGoogle(saved, actorId);
  }

  public completeTask(id: string, actorId?: string): Promise<TaskEntity> {
    return this.updateTask(id, { status: 'completed' }, actorId);
  }

  /** Soft delete; the Google copy is removed when its account is still connected. */
  public async deleteTask(id: string, actorId?: string): Promise<TaskEntity> {
    const row = await this.getTask(id);
    row.deletedAt = new Date();
    const saved = await this.taskRepo.save(row);
    if (row.googleTaskId) {
      const target = await resolveGoogleCopyTarget(
        this.googleAuth,
        row.googleAccountEmail,
        actorId,
      );
      if (target.reachable) {
        try {
          await this.google.deleteTask(row.googleTaskId, row.googleTaskListId, target.userId);
        } catch (err) {
          const status = googleErrorStatus(err);
          // Already gone on Google (deleted there or never existed): nothing left to do.
          if (status !== 404 && status !== 410) {
            this.logger.warn(`Could not delete Google copy of ${row.id}: ${errorMessage(err)}`);
          }
        }
      }
    }
    return saved;
  }

  /** Retry writing the Google copy (after a failure, or to move it to the current account). */
  public async resyncTask(id: string, actorId?: string): Promise<TaskEntity> {
    return this.pushToGoogle(await this.getTask(id), actorId);
  }

  /** Open tasks whose titles look like the requested ones (see `arePotentialDuplicateTaskTitles`). */
  public async findPotentialDuplicateTasks(
    requestedTitles: readonly string[],
    viewerId?: string,
  ): Promise<TaskDuplicateWarning[]> {
    const open = await this.listTasks({
      status: 'needsAction',
      limit: 200,
      importForUserId: viewerId,
    });
    return requestedTitles.flatMap((requestedTitle) => {
      const title = requestedTitle.trim();
      if (!title) return [];
      const matches = open
        .filter((task) => arePotentialDuplicateTaskTitles(title, task.title))
        .map((task) => ({ id: task.id, title: task.title, notes: task.notes }));
      return matches.length > 0 ? [{ requestedTitle: title, matches }] : [];
    });
  }

  /** DTOs with creator names, source chat names and whether the Google copy is reachable. */
  public async toItems(rows: readonly TaskEntity[], viewerId?: string): Promise<ITaskListItem[]> {
    const lookups = await loadRecordOriginLookups(
      rows,
      {
        googleAuth: this.googleAuth,
        userRepo: this.userRepo,
        threadConfigRepo: this.threadConfigRepo,
      },
      viewerId,
    );
    return rows.map((row) => toTaskItem(row, lookups));
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

  /**
   * Write the row's Google copy. A copy in a still-connected account is patched; a copy in an
   * account the system lost access to is re-created in the actor's current account.
   */
  private async pushToGoogle(row: TaskEntity, actorId?: string): Promise<TaskEntity> {
    const body = toGoogleTaskBody({
      title: row.title,
      notes: row.notes ?? null,
      dueAt: row.dueAt ?? null,
      status: row.status,
      completedAt: row.completedAt ?? null,
    });
    if (row.googleTaskId) {
      const target = await resolveGoogleCopyTarget(
        this.googleAuth,
        row.googleAccountEmail,
        actorId,
      );
      if (target.reachable) {
        return this.writeCopy(row, actorId, () =>
          this.google.patchTask(row.googleTaskId ?? '', body, row.googleTaskListId, target.userId),
        );
      }
    }
    if (!this.googleAuth.isAuthorized(actorId)) {
      // Keep pointing at the old copy if there is one; otherwise the task is app-only.
      if (!row.googleTaskId && row.syncStatus !== 'local') {
        row.syncStatus = 'local';
        return this.taskRepo.save(row);
      }
      return row;
    }
    const email = await this.googleAuth.getAccountEmail(actorId);
    return this.writeCopy(row, actorId, async () => {
      const created = await this.google.insertTask(body, actorId);
      row.googleTaskId = created.id ?? null;
      row.googleTaskListId = DEFAULT_LIST;
      row.googleAccountEmail = email;
      return created;
    });
  }

  private async writeCopy(
    row: TaskEntity,
    actorId: string | undefined,
    write: () => Promise<unknown>,
  ): Promise<TaskEntity> {
    try {
      await write();
      row.syncStatus = 'synced';
      row.syncedAt = new Date();
    } catch (err) {
      this.logger.warn(`Google Tasks sync failed for task ${row.id}: ${errorMessage(err)}`);
      if (actorId !== undefined) await this.googleAuth.handleAuthError(actorId, err);
      row.syncStatus = 'failed';
    }
    return this.taskRepo.save(row);
  }

  /** Import the viewer's Google account, at most once every few minutes per account. */
  private async importFromGoogle(viewerId: string): Promise<void> {
    if (!this.googleAuth.isAuthorized(viewerId)) return;
    let email: string | null;
    try {
      email = await this.googleAuth.getAccountEmail(viewerId);
    } catch {
      return;
    }
    if (!email) return;
    const accountEmail = email;

    const last = this.recentImports.get(accountEmail);
    if (last !== undefined && Date.now() - last < IMPORT_THROTTLE_MS) return;

    // One import per account at a time; concurrent callers wait for the same run.
    let running = this.runningImports.get(accountEmail);
    if (running === undefined) {
      running = this.importAccount(accountEmail, viewerId).finally(() =>
        this.runningImports.delete(accountEmail),
      );
      this.runningImports.set(accountEmail, running);
    }
    try {
      await running;
      this.recentImports.set(accountEmail, Date.now());
    } catch (err) {
      this.logger.warn(`Google Tasks import failed for ${accountEmail}: ${errorMessage(err)}`);
      await this.googleAuth.handleAuthError(viewerId, err);
    }
  }

  /**
   * Upsert every Google task of the account, then soft-delete this account's rows that Google
   * no longer returns (deleted in Google). Rows with a local change not yet on Google
   * (`pending`/`failed`) are left alone so the import cannot overwrite it. Written without
   * entity listeners so a bulk import does not flood the audit log.
   */
  private async importAccount(accountEmail: string, viewerId: string): Promise<void> {
    const remote = (await this.google.listAllTasks(viewerId)).filter(
      (item) => item.task.id && !item.task.deleted,
    );
    const remoteIds = remote.map((item) => item.task.id).filter((id): id is string => !!id);
    const known = new Map<string, TaskEntity>();
    for (let i = 0; i < remoteIds.length; i += 500) {
      const rows = await this.taskRepo.find({
        where: { googleAccountEmail: accountEmail, googleTaskId: In(remoteIds.slice(i, i + 500)) },
      });
      for (const row of rows) if (row.googleTaskId) known.set(row.googleTaskId, row);
    }

    const now = new Date();
    for (const { listId, task } of remote) {
      const fields = fromGoogleTask(task);
      if (!task.id || !fields) continue;
      const row = known.get(task.id);
      if (row) {
        // Deleted in zalobot, or a local change still waiting to reach Google: keep ours.
        if (row.deletedAt || row.syncStatus !== 'synced') continue;
        if (!differsFromRow(row, fields) && row.googleTaskListId === listId) continue;
        await this.taskRepo
          .createQueryBuilder()
          .update(TaskEntity)
          .set({ ...fields, googleTaskListId: listId, syncedAt: now })
          .where('id = :id', { id: row.id })
          .callListeners(false)
          .execute();
        continue;
      }
      await this.taskRepo
        .createQueryBuilder()
        .insert()
        .into(TaskEntity)
        .values({
          ...fields,
          source: 'google',
          googleTaskId: task.id,
          googleTaskListId: listId,
          googleAccountEmail: accountEmail,
          syncStatus: 'synced',
          syncedAt: now,
        })
        .orIgnore()
        .callListeners(false)
        .execute();
    }

    const vanished = this.taskRepo
      .createQueryBuilder()
      .update(TaskEntity)
      .set({ deletedAt: now })
      .where('google_account_email = :accountEmail', { accountEmail })
      .andWhere('google_task_id IS NOT NULL')
      .andWhere('deleted_at IS NULL')
      .andWhere("sync_status = 'synced'");
    if (remoteIds.length) vanished.andWhere('google_task_id NOT IN (:...remoteIds)', { remoteIds });
    await vanished.callListeners(false).execute();
  }
}
