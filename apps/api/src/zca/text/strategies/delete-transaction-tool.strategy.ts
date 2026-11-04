import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { FinanceService } from '../../../finance/finance.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { cleanToolArguments } from '../../../llm/utils/tool-arguments.util';
import { findTransactionTargets } from '../transaction-target';

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

    const [transaction] = await findTransactionTargets(this.financeService, {
      args,
      senderId: context.senderId,
      text: context.text,
    });

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
