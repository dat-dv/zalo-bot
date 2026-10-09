import { Injectable, Logger } from '@nestjs/common';
import { google, tasks_v1 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

export interface CreateTaskOptions {
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp (e.g. 2026-08-23T23:59:59.000Z)
  taskListId?: string;
}

export interface UpdateTaskOptions {
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
}

export interface ListTasksOptions {
  taskListId?: string;
  showCompleted?: boolean;
  showHidden?: boolean;
  dueMin?: string;
  dueMax?: string;
  maxResults?: number;
}

export interface PotentialDuplicateTask {
  id: string;
  title: string;
  notes?: string | null;
}

export interface TaskDuplicateWarning {
  requestedTitle: string;
  matches: PotentialDuplicateTask[];
}

export function normalizeTaskTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function arePotentialDuplicateTaskTitles(left: string, right: string): boolean {
  const normalizedLeft = normalizeTaskTitle(left);
  const normalizedRight = normalizeTaskTitle(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const shorter =
    normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = normalizedLeft.length <= normalizedRight.length ? normalizedRight : normalizedLeft;
  return shorter.split(' ').length >= 2 && longer.includes(shorter);
}

@Injectable()
export class GoogleTasksService {
  private readonly logger = new Logger(GoogleTasksService.name);

  constructor(private readonly authService: GoogleAuthService) {}

  private getTasksClient(userId?: number | string): tasks_v1.Tasks {
    const auth = this.authService.getOAuth2Client(userId);
    if (!auth || !this.authService.isAuthorized(userId)) {
      throw new Error(
        'Tài khoản Google Tasks của bạn chưa được kết nối. Vui lòng gõ /login trên bot để liên kết tài khoản Google cá nhân.',
      );
    }
    return google.tasks({ version: 'v1', auth });
  }

  public async listTaskLists(userId?: number | string): Promise<tasks_v1.Schema$TaskList[]> {
    const tasks = this.getTasksClient(userId);
    const res = await tasks.tasklists.list();
    return res.data.items || [];
  }

  public async listTasks(
    options: ListTasksOptions = {},
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task[]> {
    const tasks = this.getTasksClient(userId);
    const taskListId = options.taskListId || '@default';
    const showCompleted = options.showCompleted ?? false;
    const showHidden = options.showHidden ?? (showCompleted ? true : false);

    const res = await tasks.tasks.list({
      tasklist: taskListId,
      showCompleted,
      showHidden,
      dueMin: options.dueMin,
      dueMax: options.dueMax,
      maxResults: options.maxResults || 50,
    });

    return res.data.items || [];
  }

  public async findPotentialDuplicateTasks(
    requestedTitles: string[],
    userId?: number | string,
  ): Promise<TaskDuplicateWarning[]> {
    const tasks = await this.listTasks({ showCompleted: false, maxResults: 50 }, userId);
    const activeTasks: PotentialDuplicateTask[] = tasks.flatMap((task) => {
      if (!task.id || !task.title?.trim()) return [];
      return [{ id: task.id, title: task.title.trim(), notes: task.notes }];
    });

    return requestedTitles.flatMap((requestedTitle) => {
      const title = requestedTitle.trim();
      if (!title) return [];
      const matches = activeTasks.filter((task) =>
        arePotentialDuplicateTaskTitles(title, task.title),
      );
      return matches.length > 0 ? [{ requestedTitle: title, matches }] : [];
    });
  }

  public async createTask(
    options: CreateTaskOptions,
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task> {
    const tasks = this.getTasksClient(userId);
    const taskListId = options.taskListId || '@default';

    const res = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: {
        title: options.title,
        notes: options.notes,
        due: options.due,
        status: 'needsAction',
      },
    });

    this.logger.log(
      `Created Google Task: "${options.title}" for user ${userId || 'default'} (ID: ${res.data.id})`,
    );
    return res.data;
  }

  public async completeTask(
    taskId: string,
    taskListId: string = '@default',
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task> {
    const tasks = this.getTasksClient(userId);

    const res = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: {
        status: 'completed',
      },
    });

    this.logger.log(`Completed Google Task: ${taskId} for user ${userId || 'default'}`);
    return res.data;
  }

  public async getTask(
    taskId: string,
    taskListId: string = '@default',
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task> {
    const tasks = this.getTasksClient(userId);
    const res = await tasks.tasks.get({ tasklist: taskListId, task: taskId });
    return res.data;
  }

  public async updateTask(
    taskId: string,
    options: UpdateTaskOptions,
    taskListId: string = '@default',
    userId?: number | string,
  ): Promise<tasks_v1.Schema$Task> {
    const tasks = this.getTasksClient(userId);
    const res = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: options,
    });
    return res.data;
  }

  public async deleteTask(
    taskId: string,
    taskListId: string = '@default',
    userId?: number | string,
  ): Promise<boolean> {
    const tasks = this.getTasksClient(userId);
    await tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId,
    });
    this.logger.log(`Deleted Google Task: ${taskId} for user ${userId || 'default'}`);
    return true;
  }
}
