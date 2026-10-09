import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class ListCalendarEventsToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LIST_CALENDAR_EVENTS;
  private readonly logger = new Logger(ListCalendarEventsToolStrategy.name);

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
      timeMin?: string;
      timeMax?: string;
      query?: string;
    };

    try {
      const events = await this.calendarService.listEvents(
        {
          timeMin: args.timeMin || new Date().toISOString(),
          timeMax: args.timeMax,
          query: args.query,
          maxResults: 15,
        },
        context.senderId,
      );

      if (events.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '📅 Không tìm thấy sự kiện nào trong khoảng thời gian này trên Google Calendar.',
        );
        return;
      }

      const eventLines = events.map((e, idx) => {
        const dt = e.start?.dateTime ? new Date(e.start.dateTime) : undefined;
        const timeStr = dt
          ? dt.toLocaleString('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Cả ngày';
        const loc = e.location ? ` (tại ${e.location})` : '';
        return `  ${idx + 1}. [${timeStr}] ${e.summary || 'Cuộc hẹn'}${loc}`;
      });

      const reply =
        `📅 KẾT QUẢ TRA CỨU LỊCH TRÌNH (${events.length})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        eventLines.join('\n') +
        `\n\n💡 Nhắn "xóa lịch <tên>" nếu bạn muốn hủy sự kiện.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list calendar events: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể lấy danh sách lịch hẹn: ${(err as Error).message}`,
      );
    }
  }
}
