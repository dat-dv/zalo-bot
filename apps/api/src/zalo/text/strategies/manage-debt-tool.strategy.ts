import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TransactionConfirmationService } from '../../../zca/confirmation/transaction-confirmation.service';
import { FinanceService } from '../../../finance/finance.service';
import { LedgerService, resolveLedgerUserIdOrSelf } from '../../../finance/ledger.service';
import { parseAmount } from '../../../llm/utils/tool-arguments.util';

@Injectable()
export class ManageDebtToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.MANAGE_DEBT;
  private readonly logger = new Logger(ManageDebtToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly confirmationService: TransactionConfirmationService,
    private readonly financeService: FinanceService,
    @Optional() private readonly ledger?: LedgerService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const ledgerUserId = await resolveLedgerUserIdOrSelf(this.ledger, context.senderId);
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

    const rawAlias =
      typeof args.counterpartyAlias === 'object' && args.counterpartyAlias !== null
        ? ((args.counterpartyAlias as Record<string, unknown>).counterpartyAlias ??
          (args.counterpartyAlias as Record<string, unknown>).value)
        : args.counterpartyAlias;
    const counterpartyAlias =
      typeof rawAlias === 'string' && rawAlias.trim() ? rawAlias.trim() : undefined;

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
      // createDebt only accepts a chosen contact or an explicit "create new", so the
      // contact is resolved here (exact normalized match) before the card is shown.
      const matches = await this.financeService.resolveContacts(
        ledgerUserId,
        counterparty,
        counterpartyAlias,
      );
      if (matches.length > 1) {
        const options = matches
          .map((c) => (c.alias ? `• ${c.displayName} (${c.alias})` : `• ${c.displayName}`))
          .join('\n');
        await this.zaloService.sendMessage(
          context.chatId,
          `🤔 Có ${matches.length} người tên "${counterparty}" trong danh bạ công nợ:\n${options}\n\n` +
            'Vui lòng nhắn lại kèm biệt danh để mình ghi đúng người.',
        );
        return;
      }
      const contact = matches[0];

      await this.confirmationService.createPendingDebt({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          userId: ledgerUserId,
          direction,
          counterparty: contact?.displayName ?? counterparty,
          counterpartyAlias: contact ? contact.alias : counterpartyAlias,
          contactId: contact?.id,
          createNewContact: contact ? undefined : true,
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
