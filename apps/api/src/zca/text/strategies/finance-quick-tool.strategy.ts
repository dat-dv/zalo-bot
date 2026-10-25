import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class FinanceQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.FINANCE;
  private readonly logger = new Logger(FinanceQuickToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const { startAt, endAt } = this.financeService.getTodayRange();
      const summary = await this.financeService.getSummary(startAt, endAt);

      if (summary.transactions.length === 0) {
        await this.zcaMessenger.sendMessage(context.chatId, 'Hôm nay chưa có giao dịch nào.');
        return;
      }

      const recentTxLines = summary.transactions.slice(0, 5).map((t, idx) => {
        const kind = t.type === 'income' ? 'Thu' : 'Chi';
        const info = [t.note, t.category].filter(Boolean).join(' · ');
        return `${idx + 1}. ${kind} ${t.amount.toLocaleString('vi-VN')}đ${info ? ` · ${info}` : ''}`;
      });

      const reply =
        `Hôm nay: Thu ${summary.income.toLocaleString('vi-VN')}đ · ` +
        `Chi ${summary.expense.toLocaleString('vi-VN')}đ · ` +
        `Số dư ${summary.balance.toLocaleString('vi-VN')}đ\n` +
        recentTxLines.join('\n');

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to get finance summary: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa xem được thu chi, thử lại sau.');
    }
  }
}
