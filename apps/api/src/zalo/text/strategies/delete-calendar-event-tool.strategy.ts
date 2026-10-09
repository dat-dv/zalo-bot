import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class DeleteCalendarEventToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DELETE_CALENDAR_EVENT;
  private readonly logger = new Logger(DeleteCalendarEventToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly calendarService: GoogleCalendarService,
    private readonly googleAuthService: GoogleAuthService,
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
      }

      if (!targetEventId) {
        await this.zaloService.sendMessage(
          context.chatId,
          '⚠️ Vui lòng cung cấp tên hoặc ID sự kiện cần xóa.',
        );
        return;
      }

      await this.calendarService.deleteEvent(targetEventId, context.senderId);

      const summaryNote = targetSummary ? ` ("${targetSummary}")` : '';
      await this.zaloService.sendMessage(
        context.chatId,
        `🗑️ Đã xóa sự kiện Google Calendar${summaryNote} thành công!`,
      );
    } catch (err) {
      this.logger.error(`Failed to delete calendar event: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể xóa sự kiện: ${(err as Error).message}`,
      );
    }
  }
}
