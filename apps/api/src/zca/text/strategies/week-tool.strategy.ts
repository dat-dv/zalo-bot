import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { CalendarService } from '../../../calendar/calendar.service';
import { formatEventStartVN } from '../../../calendar/calendar-event.mapper';
import { GoogleTasksService } from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class WeekToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.WEEK;
  private readonly logger = new Logger(WeekToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly calendarService: CalendarService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let calendarText = '';
    let tasksText = '';

    try {
      const events = await this.calendarService.listEvents({
        timeMin: now,
        timeMax: in7Days,
        limit: 15,
        importForUserId: context.senderId,
      });

      if (events.length === 0) {
        calendarText = '📅 Lịch trình 7 ngày tới: Không có sự kiện nào.';
      } else {
        calendarText =
          `📅 Lịch trình 7 ngày tới (${events.length}):\n` +
          events
            .map((e, idx) => {
              const loc = e.location ? ` @ ${e.location}` : '';
              return `  ${idx + 1}. [${formatEventStartVN(e, true)}] ${e.title}${loc}`;
            })
            .join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to list week events: ${(err as Error).message}`);
      calendarText = '📅 Lịch trình: Không thể tải sự kiện lúc này.';
    }

    // Events live in zalobot; tasks still come straight from Google Tasks.
    if (!isGoogleConnected) {
      tasksText = '📝 Việc cần làm: Chưa kết nối Google Tasks. Gõ /login để liên kết.';
    } else {
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
    }

    const reply =
      `🗓️ KẾ HOẠCH 7 NGÀY TỚI\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${calendarText}\n\n` +
      `${tasksText}\n\n` +
      `💡 Gõ /today để xem riêng kế hoạch hôm nay.`;

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
