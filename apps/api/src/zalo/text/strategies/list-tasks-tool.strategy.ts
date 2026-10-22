import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TasksService } from '../../../tasks/tasks.service';
import { formatTaskDueVN } from '../../../tasks/task.mapper';

@Injectable()
export class ListTasksToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LIST_TASKS;
  private readonly logger = new Logger(ListTasksToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
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
        importForUserId: context.senderId,
      });

      if (tasks.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '📝 Không có việc nào trong danh sách việc cần làm.',
        );
        return;
      }

      const taskLines = tasks.map((t, idx) => {
        const icon = t.status === 'completed' ? '✅' : '▫️';
        return `  ${idx + 1}. ${icon} ${t.title}${formatTaskDueVN(t)}`;
      });

      const reply =
        `📝 DANH SÁCH VIỆC CẦN LÀM\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        taskLines.join('\n') +
        `\n\n💡 Nhắn "xong việc <tên việc>" để đánh dấu hoàn thành!`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list tasks: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tra cứu danh sách việc: ${(err as Error).message}`,
      );
    }
  }
}
