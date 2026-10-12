import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';
import { parseAmount } from '../../../llm/utils/tool-arguments.util';

@Injectable()
export class ManageDebtToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.MANAGE_DEBT;
  private readonly logger = new Logger(ManageDebtToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs ?? {};

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
      await this.confirmationService.createPendingDebt({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          userId: context.senderId,
          direction,
          counterparty,
          amount,
          note,
          occurredAt: occurredAtStr,
          dueAt: dueAtStr,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending debt: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận khoản nợ.',
      );
    }
  }
}
