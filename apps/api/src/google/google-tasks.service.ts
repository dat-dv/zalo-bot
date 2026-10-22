import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { google, tasks_v1 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

/** Payload of a bot `CREATE_TASK` pending action (kept for actions queued before the DB move). */
export interface CreateTaskOptions {
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp (e.g. 2026-08-23T23:59:59.000Z)
  taskListId?: string;
}

/** Google Tasks copy of a `tasks` row. */
export interface GoogleTaskBody {
  title: string;
  notes: string | null;
  due: string | null;
  status: 'needsAction' | 'completed';
  /** Null re-opens a completed task. */
  completed?: string | null;
}

export interface RemoteGoogleTask {
  listId: string;
  task: tasks_v1.Schema$Task;
}

const DEFAULT_LIST = '@default';

/**
 * Thin Google Tasks client. Tasks live in the `tasks` table (see `TasksService`); this only
 * writes and reads the Google copy.
 */
@Injectable()
export class GoogleTasksService {
  private readonly logger = new Logger(GoogleTasksService.name);

  constructor(private readonly authService: GoogleAuthService) {}

  private getTasksClient(userId?: number | string): tasks_v1.Tasks {
    const auth = this.authService.getOAuth2Client(userId);
    if (!auth || !this.authService.isAuthorized(userId)) {
      throw new BadRequestException(
        'Tài khoản Google Tasks của bạn chưa được kết nối. Vui lòng gõ /login trên bot để liên kết tài khoản Google cá nhân.',
      );
    }
    return google.tasks({ version: 'v1', auth });
  }

  public async listTaskLists(userId?: number | string): Promise<tasks_v1.Schema$TaskList[]> {
    const tasks = this.getTasksClient(userId);
    const lists: tasks_v1.Schema$TaskList[] = [];
    let pageToken: string | undefined;
    do {
      const res = await tasks.tasklists.list({ maxResults: 100, pageToken });
      lists.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return lists;
  }

  /** Every task of every list, completed and hidden ones included. Throws on any page error. */
  public async listAllTasks(userId?: number | string): Promise<RemoteGoogleTask[]> {
    const tasks = this.getTasksClient(userId);
    const result: RemoteGoogleTask[] = [];
    for (const list of await this.listTaskLists(userId)) {
      if (!list.id) continue;
      let pageToken: string | undefined;
      do {
        const res = await tasks.tasks.list({
          tasklist: list.id,
          showCompleted: true,
          showHidden: true,
          showDeleted: false,
          maxResults: 100,
          pageToken,
        });
        for (const task of res.data.items ?? []) result.push({ listId: list.id, task });
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    }
    return result;
  }

  public async insertTask(
    body: GoogleTaskBody,
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task> {
    const tasks = this.getTasksClient(userId);
    const res = await tasks.tasks.insert({ tasklist: DEFAULT_LIST, requestBody: body });
    this.logger.log(`Created Google Task ${res.data.id} for user ${userId ?? 'default'}`);
    return res.data;
  }

  public async patchTask(
    taskId: string,
    body: GoogleTaskBody,
    taskListId: string | null | undefined,
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task> {
    const tasks = this.getTasksClient(userId);
    const res = await tasks.tasks.patch({
      tasklist: taskListId || DEFAULT_LIST,
      task: taskId,
      requestBody: body,
    });
    return res.data;
  }

  public async deleteTask(
    taskId: string,
    taskListId: string | null | undefined,
    userId?: number | string,
  ): Promise<void> {
    const tasks = this.getTasksClient(userId);
    await tasks.tasks.delete({ tasklist: taskListId || DEFAULT_LIST, task: taskId });
    this.logger.log(`Deleted Google Task ${taskId} for user ${userId ?? 'default'}`);
  }
}
