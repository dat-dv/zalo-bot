import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TasksService } from '../../../tasks/tasks.service';
import { formatTaskDueVN } from '../../../tasks/task.mapper';

@Injectable()
export class TasksQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.TASKS;
  private readonly logger = new Logger(TasksQuickToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
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
        const syncNote =
          created.syncStatus === 'synced'
            ? ''
            : '\n\nℹ️ Việc đã lưu trong zalobot nhưng chưa lên Google Tasks (chưa kết nối Google hoặc đồng bộ lỗi).';
        await this.zaloService.sendMessage(
          context.chatId,
          `✅ Đã thêm việc cần làm!\n\n• Tiêu đề: ${created.title}${syncNote}`,
        );
        return;
      } catch (err) {
        this.logger.error(`Failed to create quick task: ${(err as Error).message}`);
        await this.zaloService.sendMessage(
          context.chatId,
          '⚠️ Có lỗi xảy ra khi tạo việc cần làm.',
        );
        return;
      }
    }

    // Otherwise list pending tasks
    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 15,
        importForUserId: context.senderId,
      });

      if (tasks.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '📝 DANH SÁCH VIỆC CẦN LÀM\n\n🎉 Hiện tại không có việc nào chưa hoàn thành!',
        );
        return;
      }

      const taskLines = tasks.map((t, idx) => {
        const notes = t.notes ? ` - ${t.notes}` : '';
        return `  ${idx + 1}. ▫️ ${t.title}${formatTaskDueVN(t)}${notes}`;
      });

      const reply =
        `📝 VIỆC CẦN LÀM (${tasks.length})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        taskLines.join('\n') +
        `\n\n💡 Nhắn "xong việc <tên>" để đánh dấu hoàn thành, hoặc "/task <nội dung>" để thêm việc mới.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list tasks: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tra cứu danh sách việc cần làm.',
      );
    }
  }
}
