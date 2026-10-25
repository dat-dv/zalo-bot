import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TasksService } from '../../../tasks/tasks.service';
import { formatTaskDueVN } from '../../../tasks/task.mapper';

@Injectable()
export class ListTasksToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LIST_TASKS;
  private readonly logger = new Logger(ListTasksToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly tasksService: TasksService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      showCompleted?: boolean;
      maxResults?: number;
    };

    try {
      const tasks = await this.tasksService.listTasks({
        status: args.showCompleted ? undefined : 'needsAction',
        limit: args.maxResults || 20,
      });

      if (tasks.length === 0) {
        await this.zcaMessenger.sendMessage(context.chatId, 'Danh sách việc cần làm đang trống.');
        return;
      }

      const taskLines = tasks.map((t, idx) => {
        const done = t.status === 'completed' ? ' · đã xong' : '';
        return `${idx + 1}. ${t.title}${formatTaskDueVN(t)}${done}`;
      });

      const reply =
        `Việc cần làm (${tasks.length}):\n` +
        taskLines.join('\n') +
        `\nXong thì nhắn "xong việc <tên việc>".`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list tasks: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa xem được việc cần làm: ${(err as Error).message}`,
      );
    }
  }
}
