import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';
import { LedgerService, resolveLedgerUserIdOrSelf } from '../../../finance/ledger.service';
import { TransactionConfirmationService } from '../../../zca/confirmation/transaction-confirmation.service';
import { cleanToolArguments } from '../../../llm/utils/tool-arguments.util';
import { FinanceTransactionEntity } from '../../../database/entities/finance-transaction.entity';

@Injectable()
export class DeleteTransactionToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DELETE_TRANSACTION;
  private readonly logger = new Logger(DeleteTransactionToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly ledger?: LedgerService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const ledgerUserId = await resolveLedgerUserIdOrSelf(this.ledger, context.senderId);
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
      transaction = await this.financeService.getTransaction(ledgerUserId, targetId);
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
          transaction = await this.financeService.getLatestTransaction(
            ledgerUserId,
            context.senderId,
          );
        } else {
          const list = await this.financeService.listTransactions(ledgerUserId);
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
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không tìm thấy giao dịch thu–chi nào phù hợp để xóa. Vui lòng kiểm tra lại mã ID hoặc nội dung giao dịch.',
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
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận xóa giao dịch.',
      );
    }
  }
}
