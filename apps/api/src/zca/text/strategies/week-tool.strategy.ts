import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { CalendarService } from '../../../calendar/calendar.service';
import { formatEventStartVN } from '../../../calendar/calendar-event.mapper';
import { TasksService } from '../../../tasks/tasks.service';
import { formatTaskDueVN } from '../../../tasks/task.mapper';

@Injectable()
export class WeekToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.WEEK;
  private readonly logger = new Logger(WeekToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly calendarService: CalendarService,
    private readonly tasksService: TasksService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
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

    // Events live in zalobot with a Google copy; tasks live only in zalobot.
    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 15,
      });

      if (tasks.length === 0) {
        tasksText = '📝 Việc cần làm: Hiện không có việc nào chưa hoàn thành.';
      } else {
        tasksText =
          `📝 Việc cần làm (${tasks.length}):\n` +
          tasks.map((t, idx) => `  ${idx + 1}. ▫️ ${t.title}${formatTaskDueVN(t)}`).join('\n');
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

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
