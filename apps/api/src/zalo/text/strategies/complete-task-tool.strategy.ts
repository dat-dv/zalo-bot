import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import {
  GoogleTasksService,
  arePotentialDuplicateTaskTitles,
} from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class CompleteTaskToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.COMPLETE_TASK;
  private readonly logger = new Logger(CompleteTaskToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    if (!isGoogleConnected) {
      await this.zaloService.sendMessage(
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

    try {
      if (!targetTaskId) {
        // Search by taskTitle in pending tasks
        const queryTitle = args.taskTitle?.trim();
        if (!queryTitle) {
          await this.zaloService.sendMessage(
            context.chatId,
            '⚠️ Vui lòng cung cấp tên việc cần hoàn thành (ví dụ: "đã xong việc nộp báo cáo").',
          );
          return;
        }

        const tasks = await this.tasksService.listTasks(
          { showCompleted: false, maxResults: 50 },
          context.senderId,
        );

        const matched = tasks.find((t) =>
          arePotentialDuplicateTaskTitles(queryTitle, t.title || ''),
        );

        if (!matched || !matched.id) {
          await this.zaloService.sendMessage(
            context.chatId,
            `⚠️ Không tìm thấy công việc nào khớp với "${queryTitle}" trong danh sách chưa hoàn thành.`,
          );
          return;
        }

        targetTaskId = matched.id;
        taskName = matched.title || queryTitle;
      }

      await this.tasksService.completeTask(targetTaskId, '@default', context.senderId);

      const titleNote = taskName ? ` "${taskName}"` : '';
      await this.zaloService.sendMessage(
        context.chatId,
        `🎉 ĐÃ HOÀN THÀNH CÔNG VIỆC${titleNote} TRÊN GOOGLE TASKS!`,
      );
    } catch (err) {
      this.logger.error(`Failed to complete task: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể đánh dấu hoàn thành: ${(err as Error).message}`,
      );
    }
  }
}
