import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class CreateCalendarEventToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_CALENDAR_EVENT;
  private readonly logger = new Logger(CreateCalendarEventToolStrategy.name);

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
      const _event = await this.calendarService.createEvent(
        {
          summary,
          startDateTime,
          endDateTime,
          description: args.description,
          location: args.location,
          reminderMinutes: [60, 30, 10, 0], // 4 mốc chuông popup dồn dập
        },
        context.senderId,
      );

      const startTimeStr = new Date(startDateTime).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const endTimeStr = new Date(endDateTime).toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      });

      const locationStr = args.location ? `\n• Địa điểm: ${args.location}` : '';

      const reply =
        `✅ ĐÃ TẠO SỰ KIỆN GOOGLE CALENDAR THÀNH CÔNG!\n\n` +
        `• Tiêu đề: ${summary}\n` +
        `• Thời gian: ${startTimeStr} – ${endTimeStr}${locationStr}\n` +
        `• Báo chuông: 4 mốc (60p, 30p, 10p, đúng giờ)\n\n` +
        `🔗 Sự kiện đã được đồng bộ lên Google Calendar của bạn.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to create calendar event: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tạo lịch hẹn: ${(err as Error).message}`,
      );
    }
  }
}
