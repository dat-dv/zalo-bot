import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';

@Injectable()
export class CreateCalendarEventToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_CALENDAR_EVENT;
  private readonly logger = new Logger(CreateCalendarEventToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      summary?: string;
      startDateTime?: string;
      endDateTime?: string;
      description?: string;
      location?: string;
    };

    const summary =
      typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : 'Cuộc hẹn';
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

    const startDateTime = args.startDateTime || defaultStart.toISOString();
    const endDateTime = args.endDateTime || defaultEnd.toISOString();

    try {
      await this.confirmationService.createPendingCalendarEvent({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          summary,
          startDateTime,
          endDateTime,
          description: args.description,
          location: args.location,
          reminderMinutes: [60, 30, 10, 0],
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending calendar event: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Chưa tạo được yêu cầu thêm lịch hẹn: ${(err as Error).message}`,
      );
    }
  }
}
