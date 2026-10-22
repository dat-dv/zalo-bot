import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { CalendarService } from '../../../calendar/calendar.service';
import { formatEventStartVN } from '../../../calendar/calendar-event.mapper';
import { GoogleTasksService } from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { FinanceService } from '../../../finance/finance.service';
import { getStartAndEndOfDayInTz } from '../../../common/utils/datetime.util';

@Injectable()
export class TodayToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.TODAY;
  private readonly logger = new Logger(TodayToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly calendarService: CalendarService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

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

    // Events live in zalobot; tasks still come straight from Google Tasks.
    if (isGoogleConnected) {
      try {
        const tasks = await this.tasksService.listTasks(
          { showCompleted: false, maxResults: 10 },
          context.senderId,
        );

        if (tasks.length === 0) {
          tasksSection = '📝 Việc cần làm: Tuyệt vời! Không còn việc nào tồn đọng.';
        } else {
          tasksSection =
            `📝 Việc cần làm (${tasks.length}):\n` +
            tasks
              .map((t, idx) => {
                const dueText = t.due ? ` (Hạn: ${t.due.slice(0, 10)})` : '';
                return `  ${idx + 1}. ▫️ ${t.title || 'Chưa đặt tên'}${dueText}`;
              })
              .join('\n');
        }
      } catch (err) {
        this.logger.error(`Failed to fetch tasks: ${(err as Error).message}`);
        tasksSection = '📝 Việc cần làm: Không thể tra cứu lúc này.';
      }
    } else {
      tasksSection = '⚠️ Google Tasks: Chưa kết nối. Gõ /login để liên kết ngay.';
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

    await this.zaloService.sendMessage(context.chatId, reply);
  }
}
