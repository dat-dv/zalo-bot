import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleTasksService } from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class WeekToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.WEEK;
  private readonly logger = new Logger(WeekToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly calendarService: GoogleCalendarService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    if (!isGoogleConnected) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Bạn chưa kết nối Google Workspace. Vui lòng gõ /login để liên kết Google Calendar & Tasks.',
      );
      return;
    }

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let calendarText = '';
    let tasksText = '';

    try {
      const events = await this.calendarService.listEvents(
        {
          timeMin: now.toISOString(),
          timeMax: in7Days.toISOString(),
          maxResults: 15,
        },
        context.senderId,
      );

      if (events.length === 0) {
        calendarText = '📅 Lịch trình 7 ngày tới: Không có sự kiện nào.';
      } else {
        calendarText =
          `📅 Lịch trình 7 ngày tới (${events.length}):\n` +
          events
            .map((e, idx) => {
              const dt = e.start?.dateTime ? new Date(e.start.dateTime) : undefined;
              const dateStr = dt
                ? dt.toLocaleDateString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Cả ngày';
              const loc = e.location ? ` @ ${e.location}` : '';
              return `  ${idx + 1}. [${dateStr}] ${e.summary || 'Cuộc hẹn'}${loc}`;
            })
            .join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to list week events: ${(err as Error).message}`);
      calendarText = '📅 Lịch trình: Không thể tải sự kiện lúc này.';
    }

    try {
      const tasks = await this.tasksService.listTasks(
        { showCompleted: false, maxResults: 15 },
        context.senderId,
      );

      if (tasks.length === 0) {
        tasksText = '📝 Việc cần làm: Hiện không có việc nào chưa hoàn thành.';
      } else {
        tasksText =
          `📝 Việc cần làm (${tasks.length}):\n` +
          tasks
            .map((t, idx) => {
              const due = t.due ? ` (Hạn: ${t.due.slice(0, 10)})` : '';
              return `  ${idx + 1}. ▫️ ${t.title || 'Chưa đặt tên'}${due}`;
            })
            .join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to list week tasks: ${(err as Error).message}`);
      tasksText = '📝 Việc cần làm: Không thể tải việc cần làm lúc này.';
    }

    const reply =
      `🗓️ KẾ HOẠCH 7 NGÀY TỚI\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${calendarText}\n\n` +
      `${tasksText}\n\n` +
      `💡 Gõ /today để xem riêng kế hoạch hôm nay.`;

    await this.zaloService.sendMessage(context.chatId, reply);
  }
}
