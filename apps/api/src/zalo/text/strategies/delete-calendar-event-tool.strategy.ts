import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';

@Injectable()
export class DeleteCalendarEventToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DELETE_CALENDAR_EVENT;
  private readonly logger = new Logger(DeleteCalendarEventToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly calendarService: GoogleCalendarService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    if (!isGoogleConnected) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Bạn chưa kết nối Google Workspace. Vui lòng gõ /login để liên kết Google Calendar.',
      );
      return;
    }

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
        const events = await this.calendarService.listEvents(
          { query: args.query, maxResults: 5 },
          context.senderId,
        );
        if (events.length === 0) {
          await this.zaloService.sendMessage(
            context.chatId,
            `⚠️ Không tìm thấy sự kiện nào khớp với từ khóa "${args.query}" trên Calendar.`,
          );
          return;
        }
        const matched = events[0];
        targetEventId = matched.id || undefined;
        targetSummary = matched.summary || '';
        targetStart = matched.start?.dateTime || matched.start?.date || undefined;
        targetEnd = matched.end?.dateTime || matched.end?.date || undefined;
        targetLocation = matched.location || undefined;
        targetDescription = matched.description || undefined;
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
          summary: targetSummary || 'Sự kiện Google Calendar',
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
