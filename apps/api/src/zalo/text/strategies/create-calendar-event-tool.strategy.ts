import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';

@Injectable()
export class CreateCalendarEventToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_CALENDAR_EVENT;
  private readonly logger = new Logger(CreateCalendarEventToolStrategy.name);

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
        '⚠️ Tài khoản Google Calendar của bạn chưa được liên kết.\n\nVui lòng gõ /login để nhận link kết nối Google Workspace trước nhé!',
      );
      return;
    }

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
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo yêu cầu lịch hẹn: ${(err as Error).message}`,
      );
    }
  }
}
