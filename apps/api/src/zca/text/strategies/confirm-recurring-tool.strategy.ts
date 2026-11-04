import { Injectable, Logger } from '@nestjs/common';
import { RecurringTransactionService } from '../../../finance/recurring/recurring-transaction.service';
import { cleanToolArguments } from '../../../llm/utils/tool-arguments.util';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { formatShortDateVN } from '../../confirmation/compact-summary.util';
import type { ConfirmRecurringPayload } from '../../confirmation/dto-descriptor.util';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TextToolContext, TextToolStrategy } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';

const MAX_LISTED = 5;

/** Records or skips a fixed income or expense waiting for this period, through a normal card. */
@Injectable()
export class ConfirmRecurringToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CONFIRM_RECURRING;
  private readonly logger = new Logger(ConfirmRecurringToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly recurring: RecurringTransactionService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = cleanToolArguments(context.toolArgs || {});
    const query = typeof args.query === 'string' ? args.query : '';
    const matches = await this.recurring.findDue(query);

    if (matches.length === 0) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        'Không có khoản cố định nào đang chờ ghi.',
      );
      return;
    }
    if (matches.length > 1) {
      const lines = matches
        .slice(0, MAX_LISTED)
        .map((row) => `• ${row.rule?.note} · ${formatShortDateVN(row.dueAt)}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `Có ${matches.length} khoản đang chờ, nhắn rõ khoản nào:\n${lines.join('\n')}`,
      );
      return;
    }

    const [occurrence] = matches;
    const skip = args.skip === true;
    const amount = Math.round(Number(args.amount ?? occurrence.amount));
    if (!skip && (!Number.isSafeInteger(amount) || amount <= 0)) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `Kỳ này ${occurrence.rule?.note} bao nhiêu tiền?`,
      );
      return;
    }

    const payload: ConfirmRecurringPayload = {
      occurrenceId: occurrence.id,
      type: occurrence.rule?.type ?? 'expense',
      note: occurrence.rule?.note ?? '',
      amount: skip ? 0 : amount,
      dueAt: occurrence.dueAt.toISOString(),
      skip,
    };
    try {
      await this.confirmationService.createPendingRecurring({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to create pending recurring: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa ghi nhận được, thử lại sau.');
    }
  }
}
