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
        calendarSection = '📅 Lịch hẹn: Hôm nay bạn không có lịch hẹn nào.';
      } else {
        calendarSection =
          `📅 Lịch hẹn hôm nay (${events.length}):\n` +
          events
            .map((e, idx) => {
              const loc = e.location ? ` (tại ${e.location})` : '';
              return `  ${idx + 1}. [${formatEventStartVN(e, false)}] ${e.title}${loc}`;
            })
            .join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to fetch today events: ${(err as Error).message}`);
      calendarSection = '📅 Lịch hẹn: Không thể tra cứu lúc này.';
    }

    // Events and tasks both live in zalobot; Google only holds copies.
    try {
      const tasks = await this.tasksService.listTasks({
        status: 'needsAction',
        limit: 10,
        importForUserId: context.senderId,
      });

      if (tasks.length === 0) {
        tasksSection = '📝 Việc cần làm: Tuyệt vời! Không còn việc nào tồn đọng.';
      } else {
        tasksSection =
          `📝 Việc cần làm (${tasks.length}):\n` +
          tasks.map((t, idx) => `  ${idx + 1}. ▫️ ${t.title}${formatTaskDueVN(t)}`).join('\n');
      }
    } catch (err) {
      this.logger.error(`Failed to fetch tasks: ${(err as Error).message}`);
      tasksSection = '📝 Việc cần làm: Không thể tra cứu lúc này.';
    }

    let financeSection = '';
    try {
      const summary = await this.financeService.getSummary(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
      );
      financeSection =
        `💰 Thu chi hôm nay:\n` +
        `• Thu: ${summary.income.toLocaleString('vi-VN')} đ | Chi: ${summary.expense.toLocaleString('vi-VN')} đ\n` +
        `• Chênh lệch: ${summary.balance.toLocaleString('vi-VN')} đ`;
    } catch {
      financeSection = '💰 Thu chi: Không thể lấy dữ liệu thu chi.';
    }

    const reply =
      `🌅 TỔNG QUAN HÔM NAY (${now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit' })})\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${calendarSection}\n\n` +
      `${tasksSection}\n\n` +
      `${financeSection}\n\n` +
      `💡 Nhắn tin tự nhiên cho bot nếu bạn muốn thêm lịch, việc cần làm hoặc ghi chép chi tiêu!`;

    await this.zcaMessenger.sendMessage(context.chatId, reply);
  }
}
