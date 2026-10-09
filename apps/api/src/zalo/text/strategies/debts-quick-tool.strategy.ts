import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class DebtsQuickToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DEBTS;
  private readonly logger = new Logger(DebtsQuickToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const debts = await this.financeService.getActiveDebts(context.senderId);

      if (debts.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '💳 SỔ CÔNG NỢ\n\nHiện tại bạn không có khoản công nợ nào chưa tất toán. 🎉',
        );
        return;
      }

      const receivable = debts
        .filter((d) => d.direction === 'receivable')
        .reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);
      const payable = debts
        .filter((d) => d.direction === 'payable')
        .reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);

      const debtLines = debts.slice(0, 10).map((d, idx) => {
        const relation = d.direction === 'receivable' ? '👉 Họ nợ bạn' : '👈 Bạn nợ họ';
        const contactName = d.contact?.displayName || d.counterparty || 'Người quen';
        const remaining = Number(d.remainingAmount || 0).toLocaleString('vi-VN');
        const dueText = d.dueAt
          ? ` (Hạn: ${new Date(d.dueAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`
          : '';
        const note = d.note ? ` - ${d.note}` : '';
        return `  ${idx + 1}. ${contactName} [${relation}]: ${remaining} đ${dueText}${note}`;
      });

      const reply =
        `💳 SỔ CÔNG NỢ (${debts.length} khoản)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• Cần thu (họ nợ): ${receivable.toLocaleString('vi-VN')} đ\n` +
        `• Cần trả (bạn nợ): ${payable.toLocaleString('vi-VN')} đ\n\n` +
        `📋 Danh sách chi tiết:\n` +
        debtLines.join('\n') +
        `\n\n💡 Nhắn cho bot: "Cho Nam vay 200k" hoặc "Nam trả 100k" để tự động ghi sổ.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list debts: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tra cứu sổ công nợ.',
      );
    }
  }
}
