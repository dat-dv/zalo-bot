import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class FinanceQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.FINANCE;
  private readonly logger = new Logger(FinanceQuickToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const { startAt, endAt } = this.financeService.getTodayRange();
      const summary = await this.financeService.getSummary(startAt, endAt);

      const recentTxLines = summary.transactions.slice(0, 5).map((t, idx) => {
        const icon = t.type === 'income' ? '🟢 Thu' : '🔴 Chi';
        return `  ${idx + 1}. ${icon}: ${t.amount.toLocaleString('vi-VN')} đ — ${t.note} (${t.category})`;
      });

      const details =
        recentTxLines.length > 0
          ? `\n\n📋 Giao dịch hôm nay:\n${recentTxLines.join('\n')}`
          : '\n\n(Hôm nay chưa có giao dịch nào)';

      const reply =
        `💰 THU–CHI HÔM NAY\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• Tổng thu: ${summary.income.toLocaleString('vi-VN')} đ\n` +
        `• Tổng chi: ${summary.expense.toLocaleString('vi-VN')} đ\n` +
        `• Số dư hôm nay: ${summary.balance.toLocaleString('vi-VN')} đ` +
        details +
        `\n\n💡 Bạn có thể nhắn tin nhanh: "Ăn sáng 35k" hoặc "Lương 15tr" để ghi sổ ngay.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to get finance summary: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tra cứu dữ liệu thu chi.',
      );
    }
  }
}
