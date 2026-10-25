import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { FinanceService } from '../../../finance/finance.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { cleanToolArguments } from '../../../llm/utils/tool-arguments.util';
import { FinanceTransactionEntity } from '../../../database/entities/finance-transaction.entity';

@Injectable()
export class DeleteTransactionToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DELETE_TRANSACTION;
  private readonly logger = new Logger(DeleteTransactionToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly financeService: FinanceService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const rawArgs = context.toolArgs || {};
    const args = cleanToolArguments(rawArgs);

    let targetId: string | undefined;
    if (typeof args.transactionId === 'string' && args.transactionId.trim()) {
      targetId = args.transactionId.trim();
    } else if (typeof args.id === 'string' && args.id.trim()) {
      targetId = args.id.trim();
    }

    // Fallback: extract UUID from raw text if not parsed into arguments
    if (!targetId && context.text) {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = context.text.match(uuidRegex);
      if (match) {
        targetId = match[0];
      }
    }

    let transaction: FinanceTransactionEntity | null = null;

    if (targetId) {
      transaction = await this.financeService.getTransaction(targetId);
    }

    if (!transaction) {
      // Try searching by query
      const query =
        typeof args.query === 'string' && args.query.trim() ? args.query.trim() : undefined;

      if (query) {
        const lowerQ = query.toLowerCase();
        if (
          lowerQ.includes('gần nhất') ||
          lowerQ.includes('mới nhất') ||
          lowerQ.includes('vừa tạo') ||
          lowerQ.includes('vừa xong')
        ) {
          transaction = await this.financeService.getLatestTransaction(context.senderId);
        } else {
          const list = await this.financeService.listTransactions();
          // Find matching transaction by note or category
          transaction =
            list.find(
              (t) =>
                (t.note && t.note.toLowerCase().includes(lowerQ)) ||
                (t.category && t.category.toLowerCase().includes(lowerQ)),
            ) || null;
        }
      }
    }

    if (!transaction) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Không tìm thấy giao dịch nào để xoá. Kiểm tra lại mã hoặc nội dung giao dịch.',
      );
      return;
    }

    try {
      await this.confirmationService.createPendingDelete({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          transactionId: transaction.id,
          type: transaction.type,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          category: transaction.category,
          note: transaction.note,
          occurredAt: transaction.occurredAt
            ? new Date(transaction.occurredAt).toISOString()
            : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending delete transaction: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa tạo được yêu cầu xoá giao dịch, thử lại sau.',
      );
    }
  }
}
