import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleCalendarService } from '../../../google/google-calendar.service';
import { GoogleTasksService } from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { FinanceService } from '../../../finance/finance.service';
import { LedgerService, resolveLedgerUserIdOrSelf } from '../../../finance/ledger.service';
import { getStartAndEndOfDayInTz } from '../../../common/utils/datetime.util';

@Injectable()
export class TodayToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.TODAY;
  private readonly logger = new Logger(TodayToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly calendarService: GoogleCalendarService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly financeService: FinanceService,
    @Optional() private readonly ledger?: LedgerService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const ledgerUserId = await resolveLedgerUserIdOrSelf(this.ledger, context.senderId);
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    const now = new Date();
    const { startOfDay, endOfDay } = getStartAndEndOfDayInTz(now, 'Asia/Ho_Chi_Minh');

    let calendarSection = '';
    let tasksSection = '';

    if (isGoogleConnected) {
      try {
        const events = await this.calendarService.listEvents(
          {
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            maxResults: 10,
          },
          context.senderId,
        );

        if (events.length === 0) {
          calendarSection = '📅 Lịch hẹn: Hôm nay bạn không có lịch hẹn nào.';
        } else {
          calendarSection =
            `📅 Lịch hẹn hôm nay (${events.length}):\n` +
            events
              .map((e, idx) => {
                const startTime = e.start?.dateTime
                  ? new Date(e.start.dateTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Ho_Chi_Minh',
                    })
                  : 'Cả ngày';
                const loc = e.location ? ` (tại ${e.location})` : '';
                return `  ${idx + 1}. [${startTime}] ${e.summary || 'Không có tiêu đề'}${loc}`;
              })
              .join('\n');
        }
      } catch (err) {
        this.logger.error(`Failed to fetch today events: ${(err as Error).message}`);
        calendarSection = '📅 Lịch hẹn: Không thể tra cứu lúc này.';
      }

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
      calendarSection = '⚠️ Google Calendar & Tasks: Chưa kết nối. Gõ /login để liên kết ngay.';
    }

    let financeSection = '';
    try {
      const summary = await this.financeService.getSummary(
        ledgerUserId,
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
