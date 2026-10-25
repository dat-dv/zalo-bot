import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class DebtsQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DEBTS;
  private readonly logger = new Logger(DebtsQuickToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const debts = await this.financeService.getActiveDebts();

      if (debts.length === 0) {
        await this.zcaMessenger.sendMessage(context.chatId, 'Không có khoản nợ nào chưa tất toán.');
        return;
      }

      const receivable = debts
        .filter((d) => d.direction === 'receivable')
        .reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);
      const payable = debts
        .filter((d) => d.direction === 'payable')
        .reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);

      const debtLines = debts.slice(0, 10).map((d, idx) => {
        const contactName = d.contact?.displayName || d.counterparty || 'Người quen';
        const relation =
          d.direction === 'receivable' ? `${contactName} nợ bạn` : `Bạn nợ ${contactName}`;
        const remaining = Number(d.remainingAmount || 0).toLocaleString('vi-VN');
        const dueText = d.dueAt
          ? ` · hạn ${new Date(d.dueAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
          : '';
        const note = d.note ? ` · ${d.note}` : '';
        return `${idx + 1}. ${relation} ${remaining}đ${dueText}${note}`;
      });

      const reply =
        `Còn ${debts.length} khoản nợ: cần thu ${receivable.toLocaleString('vi-VN')}đ, ` +
        `cần trả ${payable.toLocaleString('vi-VN')}đ\n` +
        debtLines.join('\n');

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list debts: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa xem được sổ nợ, thử lại sau.');
    }
  }
}
