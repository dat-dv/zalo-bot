import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TasksService } from '../../../tasks/tasks.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import {
  nagRuleFromArgs,
  reminderModeFromArgs,
  requestedTimesFromArgs,
  reminderUsersForRequest,
} from '../reminder-target-args.util';

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
      remindAt?: string;
    };

    const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim() : '';

    if (!title) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa rõ việc cần làm là gì, nhắn lại kèm nội dung việc.',
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
          duplicateWarning = `⚠️ Đã có việc tương tự trong danh sách: ${matchedTitles}.`;
        }
      } catch {
        // ignore duplicate check errors
      }

      const remindTimes = requestedTimesFromArgs(context.toolArgs ?? {});
      // People only matter with a reminder; the task reminder goes to this chat, and in a
      // group it tags someone (the sender when nobody is tagged, the card's people on an edit).
      const remindUsers =
        remindTimes.length > 0
          ? reminderUsersForRequest(context, context.toolArgs?.remindSelf === true)
          : [];
      await this.confirmationService.createPendingTask({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          title,
          due: args.due,
          notes: args.notes,
          remindAt: remindTimes[0]?.at,
          remindTimes: remindTimes.length > 0 ? remindTimes : undefined,
          ...(remindTimes.length > 0 ? nagRuleFromArgs(context.toolArgs ?? {}) : {}),
          remindUsers: remindUsers.length > 0 ? remindUsers : undefined,
          remindMode:
            remindUsers.length > 0 ? reminderModeFromArgs(context.toolArgs ?? {}) : undefined,
        },
      });

      if (duplicateWarning) {
        await this.zcaMessenger.sendMessage(context.chatId, duplicateWarning);
      }
    } catch (err) {
      this.logger.error(`Failed to create pending task: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa tạo được yêu cầu thêm việc: ${(err as Error).message}`,
      );
    }
  }
}
