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
        calendarText = 'Không có lịch hẹn nào trong 7 ngày tới.';
      } else {
        calendarText =
          `Lịch hẹn (${events.length}):\n` +
          events
            .map((e, idx) => {
              const loc = e.location ? ` · ${e.location}` : '';
              return `${idx + 1}. ${formatEventStartVN(e, true)} · ${e.title}${loc}`;
            })
            .join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to list week events: ${(err as Error).message}`);
      calendarText = 'Lịch hẹn: chưa xem được, thử lại sau.';
    }

    // Events live in zalobot with a Google copy; tasks live only in zalobot.
    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 15,
      });

      if (tasks.length === 0) {
        tasksText = 'Không còn việc nào cần làm.';
      } else {
        tasksText =
          `Việc cần làm (${tasks.length}):\n` +
          tasks.map((t, idx) => `${idx + 1}. ${t.title}${formatTaskDueVN(t)}`).join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to list week tasks: ${(err as Error).message}`);
      tasksText = 'Việc cần làm: chưa xem được, thử lại sau.';
    }

    const reply = `7 ngày tới\n\n${calendarText}\n\n${tasksText}`;

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
