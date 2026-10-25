import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TasksService } from '../../../tasks/tasks.service';
import { arePotentialDuplicateTaskTitles } from '../../../tasks/task-title.util';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';

@Injectable()
export class CompleteTaskToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.COMPLETE_TASK;
  private readonly logger = new Logger(CompleteTaskToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly tasksService: TasksService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      taskId?: string;
      taskTitle?: string;
    };

    let targetTaskId = args.taskId;
    let taskName = args.taskTitle || '';
    let taskNotes: string | undefined;
    let taskDue: string | undefined;

    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 200,
      });

      if (targetTaskId) {
        const matchedById = tasks.find((t) => t.id === targetTaskId);
        if (matchedById) {
          targetTaskId = matchedById.id;
          taskName = matchedById.title || taskName;
          taskNotes = matchedById.notes || undefined;
          taskDue = matchedById.dueAt?.toISOString();
        }
      } else {
        const queryTitle = args.taskTitle?.trim();
        if (!queryTitle) {
          await this.zcaMessenger.sendMessage(
            context.chatId,
            '⚠️ Chưa rõ việc nào đã xong. Nhắn kèm tên việc, ví dụ: "đã xong việc nộp báo cáo".',
          );
          return;
        }

        const matched = tasks.find((t) => arePotentialDuplicateTaskTitles(queryTitle, t.title));

        if (!matched) {
          await this.zcaMessenger.sendMessage(
            context.chatId,
            `⚠️ Không có việc nào đang cần làm khớp với "${queryTitle}".`,
          );
          return;
        }

        targetTaskId = matched.id;
        taskName = matched.title || queryTitle;
        taskNotes = matched.notes || undefined;
        taskDue = matched.dueAt?.toISOString();
      }

      await this.confirmationService.createPendingCompleteTask({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          taskId: targetTaskId,
          taskTitle: taskName,
          notes: taskNotes,
          due: taskDue,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending complete task: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa tạo được yêu cầu đánh dấu xong việc: ${(err as Error).message}`,
      );
    }
  }
}
