import { Injectable, Logger } from '@nestjs/common';
import type { FinanceTransactionEntity } from '../../../database/entities/finance-transaction.entity';
import { FinanceService } from '../../../finance/finance.service';
import { cleanToolArguments } from '../../../llm/utils/tool-arguments.util';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { formatShortDateVN } from '../../confirmation/compact-summary.util';
import {
  type EditTransactionChanges,
  type EditTransactionPayload,
  formatCurrencyVN,
} from '../../confirmation/dto-descriptor.util';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TextToolContext, TextToolStrategy } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { findTransactionTargets } from '../transaction-target';

const MAX_CANDIDATES = 3;

function textArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Only what really differs from the stored row, so the card never shows a change that is not one. */
export function pickTransactionChanges(
  args: Record<string, unknown>,
  current: Pick<FinanceTransactionEntity, 'type' | 'amount' | 'category' | 'note' | 'occurredAt'>,
  currentPlaceName?: string,
): EditTransactionChanges {
  const changes: EditTransactionChanges = {};
  const amount = Math.round(Number(args.amount));
  if (Number.isFinite(amount) && amount > 0 && amount !== Number(current.amount)) {
    changes.amount = amount;
  }
  if ((args.type === 'income' || args.type === 'expense') && args.type !== current.type) {
    changes.type = args.type;
  }
  const category = textArg(args.category);
  if (category && category !== current.category) changes.category = category;
  const note = textArg(args.note);
  if (note && note !== current.note) changes.note = note;
  const placeName = textArg(args.placeName);
  if (placeName && placeName !== currentPlaceName) changes.placeName = placeName;
  const occurredAt = textArg(args.occurredAt);
  if (occurredAt && !Number.isNaN(new Date(occurredAt).getTime())) {
    const next = new Date(occurredAt);
    if (next.getTime() !== new Date(current.occurredAt).getTime()) {
      changes.occurredAt = next.toISOString();
    }
  }
  return changes;
}

function candidateLine(row: FinanceTransactionEntity): string {
  const kind = row.type === 'income' ? 'Thu' : 'Chi';
  const amount = formatCurrencyVN(Number(row.amount), row.currency);
  return `• ${kind} ${amount} · ${row.note} · ${formatShortDateVN(row.occurredAt)}\n  Mã: ${row.id}`;
}

@Injectable()
export class EditTransactionToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.EDIT_TRANSACTION;
  private readonly logger = new Logger(EditTransactionToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly financeService: FinanceService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = cleanToolArguments(context.toolArgs || {});
    const matches = await findTransactionTargets(this.financeService, {
      args,
      senderId: context.senderId,
      text: context.text,
    });

    if (matches.length === 0) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Không tìm thấy giao dịch để sửa. Kiểm tra lại nội dung hoặc mã giao dịch.',
      );
      return;
    }
    // Editing the wrong row silently changes the shared ledger, so a guess is never acceptable.
    // The bot keeps no chat context, hence the id rather than "reply 2".
    if (matches.length > 1) {
      const shown = matches.slice(0, MAX_CANDIDATES).map(candidateLine);
      const more = matches.length > MAX_CANDIDATES ? ` (${matches.length} khoản khớp)` : '';
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `Có nhiều giao dịch khớp${more}, nhắn lại kèm mã khoản cần sửa:\n${shown.join('\n')}`,
      );
      return;
    }

    const transaction = (await this.financeService.getTransaction(matches[0].id)) ?? matches[0];
    const changes = pickTransactionChanges(args, transaction, transaction.place?.name);
    if (Object.keys(changes).length === 0) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        'Mình chưa thấy có gì khác so với giao dịch hiện tại, bạn muốn sửa gì?',
      );
      return;
    }

    const payload: EditTransactionPayload = {
      transactionId: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      category: transaction.category,
      note: transaction.note,
      occurredAt: new Date(transaction.occurredAt).toISOString(),
      placeName: transaction.place?.name,
      changes,
    };
    try {
      await this.confirmationService.createPendingEdit({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to create pending edit: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa tạo được yêu cầu sửa giao dịch, thử lại sau.',
      );
    }
  }
}
