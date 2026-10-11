import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleTasksService } from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';

@Injectable()
export class CreateTaskToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_TASK;
  private readonly logger = new Logger(CreateTaskToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    if (!isGoogleConnected) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Tài khoản Google Tasks của bạn chưa được liên kết.\n\nVui lòng gõ /login để nhận link kết nối Google Workspace trước nhé!',
      );
      return;
    }

    const args = (context.toolArgs ?? {}) as {
      title?: string;
      due?: string;
      notes?: string;
    };

    const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim() : '';

    if (!title) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Vui lòng cung cấp nội dung việc cần làm.',
      );
      return;
    }

    try {
      // Check for duplicate tasks
      let duplicateWarning = '';
      try {
        const dupes = await this.tasksService.findPotentialDuplicateTasks(
          [title],
          context.senderId,
        );
        if (dupes.length > 0 && dupes[0].matches.length > 0) {
          const matchedTitles = dupes[0].matches.map((m) => `"${m.title}"`).join(', ');
          duplicateWarning = `⚠️ Lưu ý: Bạn đã có việc tương tự trong danh sách: ${matchedTitles}.`;
        }
      } catch {
        // ignore duplicate check errors
      }

      await this.confirmationService.createPendingTask({
        userId: context.senderId,
        chatId: context.chatId,
        payload: {
          title,
          due: args.due,
          notes: args.notes,
        },
      });

      if (duplicateWarning) {
        await this.zaloService.sendMessage(context.chatId, duplicateWarning);
      }
    } catch (err) {
      this.logger.error(`Failed to create pending task: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo yêu cầu việc cần làm: ${(err as Error).message}`,
      );
    }
  }
}
