import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class RecordTransactionToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.RECORD_TRANSACTION;
  private readonly logger = new Logger(RecordTransactionToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs || {};
    const type = args.type === 'income' ? 'income' : 'expense';
    const amount = Math.abs(Number(args.amount) || 0);
    const category =
      typeof args.category === 'string' && args.category.trim() ? args.category.trim() : 'Khác';
    const note =
      typeof args.note === 'string' && args.note.trim() ? args.note.trim() : 'Giao dịch qua Zalo';

    if (amount <= 0) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không thể ghi nhận giao dịch với số tiền không hợp lệ.',
      );
      return;
    }

    try {
      const tx = await this.financeService.createTransaction({
        userId: Number(context.senderId) || 1,
        type,
        amount,
        category,
        note,
      });

      const typeLabel = type === 'income' ? '🟢 Khoản thu' : '🔴 Khoản chi';
      const txAmount = Number(tx.amount || amount).toLocaleString('vi-VN');

      const reply =
        `✅ Đã lưu ${typeLabel.toLowerCase()} thành công!\n\n` +
        `• Số tiền: ${txAmount} đ\n` +
        `• Danh mục: ${tx.category}\n` +
        `• Ghi chú: ${tx.note}`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to record transaction: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi lưu giao dịch thu chi.',
      );
    }
  }
}
