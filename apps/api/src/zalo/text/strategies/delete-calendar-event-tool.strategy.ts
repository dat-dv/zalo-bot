import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { CalendarService } from '../../../calendar/calendar.service';
import { TransactionConfirmationService } from '../../../zca/confirmation/transaction-confirmation.service';

@Injectable()
export class DeleteCalendarEventToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DELETE_CALENDAR_EVENT;
  private readonly logger = new Logger(DeleteCalendarEventToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly calendarService: CalendarService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      eventId?: string;
      query?: string;
    };

    let targetEventId = args.eventId;
    let targetSummary = '';
    let targetStart: string | undefined;
    let targetEnd: string | undefined;
    let targetLocation: string | undefined;
    let targetDescription: string | undefined;

    try {
      if (!targetEventId && args.query) {
        // Search matching event by query
        // Upcoming events first: deleting is about plans, not history.
        const events = await this.calendarService.listEvents({
          timeMin: new Date(),
          query: args.query,
          limit: 5,
          importForUserId: context.senderId,
        });
        if (events.length === 0) {
          await this.zaloService.sendMessage(
            context.chatId,
            `⚠️ Không tìm thấy sự kiện sắp tới nào khớp với từ khóa "${args.query}".`,
          );
          return;
        }
        const matched = events[0];
        targetEventId = matched.id;
        targetSummary = matched.title;
        targetStart = matched.startAt.toISOString();
        targetEnd = matched.endAt.toISOString();
        targetLocation = matched.location ?? undefined;
        targetDescription = matched.description ?? undefined;
      }

      if (!targetEventId) {
        await this.zaloService.sendMessage(
          context.chatId,
          '⚠️ Vui lòng cung cấp tên hoặc ID sự kiện cần xóa.',
        );
        return;
      }

      await this.confirmationService.createPendingDeleteCalendarEvent({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          eventId: targetEventId,
          summary: targetSummary || 'Sự kiện lịch',
          startDateTime: targetStart,
          endDateTime: targetEnd,
          location: targetLocation,
          description: targetDescription,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to create pending delete calendar event: ${(err as Error).message}`,
      );
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo yêu cầu xóa sự kiện: ${(err as Error).message}`,
      );
    }
  }
}
