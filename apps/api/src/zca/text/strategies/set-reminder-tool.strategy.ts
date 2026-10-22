import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import {
  nagRuleFromArgs,
  reminderModeFromArgs,
  requestedTimesFromArgs,
  reminderUsersFromContext,
  reminderUsersOrSender,
} from '../reminder-target-args.util';

@Injectable()
export class SetReminderToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SET_REMINDER;
  private readonly logger = new Logger(SetReminderToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs || {};
    const title =
      typeof args.title === 'string' && args.title.trim()
        ? args.title.trim()
        : 'Nhắc nhở công việc';
    // No usable time ⇒ one hour from now, as before. Each time keeps its own repeat.
    const requested = requestedTimesFromArgs(args);
    const remindTimes =
      requested.length > 0
        ? requested.map((time) => ({
            at: new Date(time.at),
            ...(time.repeat ? { repeat: time.repeat } : {}),
          }))
        : [{ at: new Date(Date.now() + 60 * 60 * 1000) }];

    // A personal reminder stays private unless the message tags people or asks for the group.
    const tagged = reminderUsersFromContext(context, false);
    const inGroup = args.remindInGroup === true || tagged.length > 0;
    // In the group someone is always tagged: the sender when nobody else is.
    const remindUsers = inGroup ? reminderUsersOrSender(context, args.remindSelf === true) : [];

    try {
      await this.confirmationService.createPendingReminder({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          userId: context.senderId,
          title,
          remindAt: remindTimes[0].at,
          remindTimes,
          ...nagRuleFromArgs(args),
          chatId: inGroup ? context.chatId : undefined,
          remindUsers: remindUsers.length > 0 ? remindUsers : undefined,
          remindMode: remindUsers.length > 0 ? reminderModeFromArgs(args) : undefined,
          originChatId: context.chatId,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending reminder: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận lịch nhắc.',
      );
    }
  }
}
