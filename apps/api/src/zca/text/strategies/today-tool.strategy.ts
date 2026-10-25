import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { CalendarService } from '../../../calendar/calendar.service';
import { formatEventStartVN } from '../../../calendar/calendar-event.mapper';
import { TasksService } from '../../../tasks/tasks.service';
import { formatTaskDueVN } from '../../../tasks/task.mapper';
import { FinanceService } from '../../../finance/finance.service';
import { getStartAndEndOfDayInTz } from '../../../common/utils/datetime.util';

@Injectable()
export class TodayToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.TODAY;
  private readonly logger = new Logger(TodayToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly calendarService: CalendarService,
    private readonly tasksService: TasksService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const now = new Date();
    const { startOfDay, endOfDay } = getStartAndEndOfDayInTz(now, 'Asia/Ho_Chi_Minh');

    let calendarSection = '';
    let tasksSection = '';

    try {
      const events = await this.calendarService.listEvents({
        timeMin: startOfDay,
        timeMax: endOfDay,
        limit: 10,
        importForUserId: context.senderId,
      });

      if (events.length === 0) {
        calendarSection = 'Hôm nay không có lịch hẹn.';
      } else {
        calendarSection =
          `Lịch hẹn (${events.length}):\n` +
          events
            .map((e, idx) => {
              const loc = e.location ? ` · ${e.location}` : '';
              return `${idx + 1}. ${formatEventStartVN(e, false)} · ${e.title}${loc}`;
            })
            .join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to fetch today events: ${(err as Error).message}`);
      calendarSection = 'Lịch hẹn: chưa xem được, thử lại sau.';
    }

    // Events live in zalobot with a Google copy; tasks live only in zalobot.
    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 10,
      });

      if (tasks.length === 0) {
        tasksSection = 'Không còn việc nào cần làm.';
      } else {
        tasksSection =
          `Việc cần làm (${tasks.length}):\n` +
          tasks.map((t, idx) => `${idx + 1}. ${t.title}${formatTaskDueVN(t)}`).join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to fetch tasks: ${(err as Error).message}`);
      tasksSection = 'Việc cần làm: chưa xem được, thử lại sau.';
    }

    let financeSection = '';
    try {
      const summary = await this.financeService.getSummary(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
      );
      financeSection =
        `Thu ${summary.income.toLocaleString('vi-VN')}đ · ` +
        `Chi ${summary.expense.toLocaleString('vi-VN')}đ · ` +
        `Chênh lệch ${summary.balance.toLocaleString('vi-VN')}đ`;
    } catch {
      financeSection = 'Thu chi: chưa lấy được số liệu, thử lại sau.';
    }

    const reply =
      `Hôm nay, ${now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit' })}\n\n` +
      `${calendarSection}\n\n` +
      `${tasksSection}\n\n` +
      financeSection;

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
