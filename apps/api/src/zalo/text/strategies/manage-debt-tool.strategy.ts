import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';
import { parseAmount } from '../../../llm/utils/tool-arguments.util';

@Injectable()
export class ManageDebtToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.MANAGE_DEBT;
  private readonly logger = new Logger(ManageDebtToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = (context.toolArgs ?? {}) as Record<string, unknown>;

    const rawDirection =
      typeof args.direction === 'object' && args.direction !== null
        ? ((args.direction as Record<string, unknown>).direction ??
          (args.direction as Record<string, unknown>).value)
        : args.direction;
    const direction = rawDirection === 'receivable' ? 'receivable' : 'payable';

    const rawCounterparty =
      typeof args.counterparty === 'object' && args.counterparty !== null
        ? ((args.counterparty as Record<string, unknown>).counterparty ??
          (args.counterparty as Record<string, unknown>).name ??
          (args.counterparty as Record<string, unknown>).value)
        : args.counterparty;
    const counterparty =
      typeof rawCounterparty === 'string' && rawCounterparty.trim()
        ? rawCounterparty.trim()
        : 'Người quen';

    const amount = parseAmount(args.amount);

    const rawNote =
      typeof args.note === 'object' && args.note !== null
        ? ((args.note as Record<string, unknown>).note ??
          (args.note as Record<string, unknown>).title ??
          (args.note as Record<string, unknown>).value)
        : args.note;
    const note = typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim() : undefined;

    const rawOccurredAt =
      typeof args.occurredAt === 'object' && args.occurredAt !== null
        ? ((args.occurredAt as Record<string, unknown>).occurredAt ??
          (args.occurredAt as Record<string, unknown>).value)
        : args.occurredAt;
    let occurredAtStr: string | undefined;
    if (typeof rawOccurredAt === 'string' && rawOccurredAt.trim()) {
      const parsedDate = new Date(rawOccurredAt.trim());
      if (!Number.isNaN(parsedDate.getTime())) {
        occurredAtStr = parsedDate.toISOString();
      }
    }

    const rawDueAt =
      typeof args.dueAt === 'object' && args.dueAt !== null
        ? ((args.dueAt as Record<string, unknown>).dueAt ??
          (args.dueAt as Record<string, unknown>).value)
        : args.dueAt;
    let dueAtStr: string | undefined;
    if (typeof rawDueAt === 'string' && rawDueAt.trim()) {
      const parsedDate = new Date(rawDueAt.trim());
      if (!Number.isNaN(parsedDate.getTime())) {
        dueAtStr = parsedDate.toISOString();
      }
    }

    if (amount <= 0) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không thể ghi nhận khoản nợ với số tiền không hợp lệ.',
      );
      return;
    }

    try {
      const debt = await this.financeService.createDebt({
        userId: context.senderId,
        direction,
        counterparty,
        amount,
        note,
        occurredAt: occurredAtStr,
        dueAt: dueAtStr,
      });

      const directionLabel = direction === 'receivable' ? '👉 Họ nợ bạn' : '👈 Bạn nợ họ';

      const debtAmount = Number(debt.originalAmount || amount).toLocaleString('vi-VN');

      let reply =
        `✅ Đã ghi nhận khoản nợ thành công!\n\n` +
        `• Người liên quan: ${debt.counterparty}\n` +
        `• Phân loại: ${directionLabel}\n` +
        `• Số tiền: ${debtAmount} đ` +
        (note ? `\n• Ghi chú: ${note}` : '');

      if (debt.occurredAt) {
        const dDate = new Date(debt.occurredAt);
        const formattedDate = dDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        reply += `\n• Thời gian: ${formattedDate}`;
      }

      if (debt.dueAt) {
        const dDue = new Date(debt.dueAt);
        const formattedDue = dDue.toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        reply += `\n• Hạn trả: ${formattedDue}`;
      }

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
