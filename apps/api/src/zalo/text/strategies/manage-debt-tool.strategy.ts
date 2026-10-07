import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class ManageDebtToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.MANAGE_DEBT;
  private readonly logger = new Logger(ManageDebtToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as {
      direction?: string;
      counterparty?: string;
      amount?: number | string;
      note?: string;
    };
    const direction = args.direction === 'receivable' ? 'receivable' : 'payable';
    const rawCounterparty = typeof args.counterparty === 'string' ? args.counterparty.trim() : '';
    const counterparty = rawCounterparty || 'Người quen';
    const amount = Math.abs(Number(args.amount) || 0);
    const rawNote = typeof args.note === 'string' ? args.note.trim() : '';
    const note = rawNote || undefined;

    if (amount <= 0) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không thể ghi nhận khoản nợ với số tiền không hợp lệ.',
      );
      return;
    }

    try {
      const debt = await this.financeService.createDebt({
        userId: Number(context.senderId) || 1,
        direction,
        counterparty,
        amount,
        note,
      });

      const directionLabel = direction === 'receivable' ? '👉 Họ nợ bạn' : '👈 Bạn nợ họ';

      const debtAmount = Number(debt.originalAmount || amount).toLocaleString('vi-VN');

      const reply =
        `✅ Đã ghi nhận khoản nợ thành công!\n\n` +
        `• Người liên quan: ${debt.counterparty}\n` +
        `• Phân loại: ${directionLabel}\n` +
        `• Số tiền: ${debtAmount} đ` +
        (note ? `\n• Ghi chú: ${note}` : '');

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to record debt: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi lưu khoản nợ vào cơ sở dữ liệu.',
      );
    }
  }
}
