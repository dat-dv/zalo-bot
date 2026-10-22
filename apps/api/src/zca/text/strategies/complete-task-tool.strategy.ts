import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import {
  GoogleTasksService,
  arePotentialDuplicateTaskTitles,
} from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';

@Injectable()
export class CompleteTaskToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.COMPLETE_TASK;
  private readonly logger = new Logger(CompleteTaskToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    if (!isGoogleConnected) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Bạn chưa kết nối Google Workspace. Vui lòng gõ /login để liên kết Google Tasks.',
      );
      return;
    }

    const args = (context.toolArgs ?? {}) as {
      taskId?: string;
      taskTitle?: string;
    };

    let targetTaskId = args.taskId;
    let taskName = args.taskTitle || '';
    let taskNotes: string | undefined;
    let taskDue: string | undefined;

    try {
      const tasks = await this.tasksService.listTasks(
        { showCompleted: false, maxResults: 50 },
        context.senderId,
      );

      if (targetTaskId) {
        const matchedById = tasks.find((t) => t.id === targetTaskId);
        if (matchedById) {
          taskName = matchedById.title || taskName;
          taskNotes = matchedById.notes || undefined;
          taskDue = matchedById.due || undefined;
        }
      } else {
        const queryTitle = args.taskTitle?.trim();
        if (!queryTitle) {
          await this.zcaMessenger.sendMessage(
            context.chatId,
            '⚠️ Vui lòng cung cấp tên việc cần hoàn thành (ví dụ: "đã xong việc nộp báo cáo").',
          );
          return;
        }

        const matched = tasks.find((t) =>
          arePotentialDuplicateTaskTitles(queryTitle, t.title || ''),
        );

        if (!matched || !matched.id) {
          await this.zcaMessenger.sendMessage(
            context.chatId,
            `⚠️ Không tìm thấy công việc nào khớp với "${queryTitle}" trong danh sách chưa hoàn thành.`,
          );
          return;
        }

        targetTaskId = matched.id;
        taskName = matched.title || queryTitle;
        taskNotes = matched.notes || undefined;
        taskDue = matched.due || undefined;
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
        `⚠️ Không thể tạo yêu cầu hoàn thành việc: ${(err as Error).message}`,
      );
    }
  }
}
