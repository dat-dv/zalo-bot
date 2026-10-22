import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TasksService } from '../../../tasks/tasks.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';

@Injectable()
export class CreateTaskToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_TASK;
  private readonly logger = new Logger(CreateTaskToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly tasksService: TasksService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      title?: string;
      due?: string;
      notes?: string;
    };

    const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim() : '';

    if (!title) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Vui lòng cung cấp nội dung việc cần làm.',
      );
      return;
    }

    try {
      // Check for duplicate tasks
      let duplicateWarning = '';
      try {
        const dupes = await this.tasksService.findPotentialDuplicateTasks([title]);
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
        rawPrompt: context.text,
        payload: {
          title,
          due: args.due,
          notes: args.notes,
        },
      });

      if (duplicateWarning) {
        await this.zcaMessenger.sendMessage(context.chatId, duplicateWarning);
      }
    } catch (err) {
      this.logger.error(`Failed to create pending task: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo yêu cầu việc cần làm: ${(err as Error).message}`,
      );
    }
  }
}
