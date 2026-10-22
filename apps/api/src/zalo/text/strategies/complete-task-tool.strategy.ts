import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TasksService } from '../../../tasks/tasks.service';
import { arePotentialDuplicateTaskTitles } from '../../../tasks/task-title.util';
import { TransactionConfirmationService } from '../../../zca/confirmation/transaction-confirmation.service';

@Injectable()
export class CompleteTaskToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.COMPLETE_TASK;
  private readonly logger = new Logger(CompleteTaskToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
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
        importForUserId: context.senderId,
      });

      if (targetTaskId) {
        // The model may pass a row id or the id of the task's Google copy.
        const matchedById = tasks.find(
          (t) => t.id === targetTaskId || t.googleTaskId === targetTaskId,
        );
        if (matchedById) {
          targetTaskId = matchedById.id;
          taskName = matchedById.title || taskName;
          taskNotes = matchedById.notes || undefined;
          taskDue = matchedById.dueAt?.toISOString();
        }
      } else {
        const queryTitle = args.taskTitle?.trim();
        if (!queryTitle) {
          await this.zaloService.sendMessage(
            context.chatId,
            '⚠️ Vui lòng cung cấp tên việc cần hoàn thành (ví dụ: "đã xong việc nộp báo cáo").',
          );
          return;
        }

        const matched = tasks.find((t) => arePotentialDuplicateTaskTitles(queryTitle, t.title));

        if (!matched) {
          await this.zaloService.sendMessage(
            context.chatId,
            `⚠️ Không tìm thấy công việc nào khớp với "${queryTitle}" trong danh sách chưa hoàn thành.`,
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
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo yêu cầu hoàn thành việc: ${(err as Error).message}`,
      );
    }
  }
}
