import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TasksService } from '../../../tasks/tasks.service';
import { formatTaskDueVN } from '../../../tasks/task.mapper';

@Injectable()
export class TasksQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.TASKS;
  private readonly logger = new Logger(TasksQuickToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly tasksService: TasksService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const text = context.text?.trim() || '';

    // If command is `/task <content>`, create task immediately
    if (text.startsWith('/task ') && text.length > 6) {
      const taskTitle = text.slice(6).trim();
      try {
        const created = await this.tasksService.createTask(
          { title: taskTitle },
          {
            userId: context.senderId,
            name: context.displayName,
            chatId: context.chatId,
            source: 'zalo',
          },
        );
        await this.zcaMessenger.sendMessage(context.chatId, `✅ Đã thêm việc: ${created.title}`);
        return;
      } catch (err) {
        this.logger.error(`Failed to create quick task: ${(err as Error).message}`);
        await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa thêm được việc, thử lại sau.');
        return;
      }
    }

    // Otherwise list pending tasks
    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 15,
      });

      if (tasks.length === 0) {
        await this.zcaMessenger.sendMessage(context.chatId, 'Không còn việc nào cần làm.');
        return;
      }

      const taskLines = tasks.map((t, idx) => {
        const notes = t.notes ? ` - ${t.notes}` : '';
        return `${idx + 1}. ${t.title}${formatTaskDueVN(t)}${notes}`;
      });

      const reply =
        `Việc cần làm (${tasks.length}):\n` +
        taskLines.join('\n') +
        `\nXong thì nhắn "xong việc <tên>", thêm việc thì gõ "/task <nội dung>".`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list tasks: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa xem được việc cần làm, thử lại sau.',
      );
    }
  }
}
