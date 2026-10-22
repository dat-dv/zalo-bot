import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { CalendarService } from '../../../calendar/calendar.service';
import { formatEventStartVN } from '../../../calendar/calendar-event.mapper';

@Injectable()
export class ListCalendarEventsToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LIST_CALENDAR_EVENTS;
  private readonly logger = new Logger(ListCalendarEventsToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly calendarService: CalendarService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      timeMin?: string;
      timeMax?: string;
      query?: string;
    };

    try {
      const timeMin = args.timeMin ? new Date(args.timeMin) : new Date();
      const timeMax = args.timeMax ? new Date(args.timeMax) : undefined;
      const events = await this.calendarService.listEvents({
        timeMin: Number.isNaN(timeMin.getTime()) ? new Date() : timeMin,
        timeMax: timeMax && !Number.isNaN(timeMax.getTime()) ? timeMax : undefined,
        query: args.query,
        limit: 15,
        importForUserId: context.senderId,
      });

      if (events.length === 0) {
        await this.zcaMessenger.sendMessage(
          context.chatId,
          '📅 Không tìm thấy sự kiện nào trong khoảng thời gian này.',
        );
        return;
      }

      const eventLines = events.map((e, idx) => {
        const loc = e.location ? ` (tại ${e.location})` : '';
        return `  ${idx + 1}. [${formatEventStartVN(e, true)}] ${e.title}${loc}`;
      });

      const reply =
        `📅 KẾT QUẢ TRA CỨU LỊCH TRÌNH (${events.length})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        eventLines.join('\n') +
        `\n\n💡 Nhắn "xóa lịch <tên>" nếu bạn muốn hủy sự kiện.`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list calendar events: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `⚠️ Không thể lấy danh sách lịch hẹn: ${(err as Error).message}`,
      );
    }
  }
}
