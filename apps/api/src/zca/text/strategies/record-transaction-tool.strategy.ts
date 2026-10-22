import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { FinanceService } from '../../../finance/finance.service';
import { parseAmount } from '../../../llm/utils/tool-arguments.util';

@Injectable()
export class RecordTransactionToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.RECORD_TRANSACTION;
  private readonly logger = new Logger(RecordTransactionToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly financeService?: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs || {};

    const rawType =
      typeof args.type === 'object' && args.type !== null
        ? ((args.type as Record<string, unknown>).type ??
          (args.type as Record<string, unknown>).value)
        : args.type;
    const type = rawType === 'income' ? 'income' : 'expense';

    const amount = parseAmount(args.amount);

    const rawCategory =
      typeof args.category === 'object' && args.category !== null
        ? ((args.category as Record<string, unknown>).category ??
          (args.category as Record<string, unknown>).name ??
          (args.category as Record<string, unknown>).value)
        : args.category;
    const category =
      typeof rawCategory === 'string' && rawCategory.trim() ? rawCategory.trim() : 'Khác';

    const rawNote =
      typeof args.note === 'object' && args.note !== null
        ? ((args.note as Record<string, unknown>).note ??
          (args.note as Record<string, unknown>).title ??
          (args.note as Record<string, unknown>).value)
        : args.note;
    const note =
      typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim() : 'Giao dịch qua Zalo';

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

    const rawPlaceName =
      typeof args.placeName === 'object' && args.placeName !== null
        ? ((args.placeName as Record<string, unknown>).placeName ??
          (args.placeName as Record<string, unknown>).name ??
          (args.placeName as Record<string, unknown>).value)
        : args.placeName;
    const placeName =
      typeof rawPlaceName === 'string' && rawPlaceName.trim() ? rawPlaceName.trim() : undefined;

    const rawPaymentMethod =
      typeof args.paymentMethod === 'object' && args.paymentMethod !== null
        ? ((args.paymentMethod as Record<string, unknown>).paymentMethod ??
          (args.paymentMethod as Record<string, unknown>).name ??
          (args.paymentMethod as Record<string, unknown>).value)
        : args.paymentMethod;
    const paymentMethod =
      typeof rawPaymentMethod === 'string' && rawPaymentMethod.trim()
        ? rawPaymentMethod.trim()
        : undefined;

    const rawReceiptUrl =
      typeof args.receiptUrl === 'object' && args.receiptUrl !== null
        ? ((args.receiptUrl as Record<string, unknown>).receiptUrl ??
          (args.receiptUrl as Record<string, unknown>).value)
        : args.receiptUrl;
    const receiptUrl =
      typeof rawReceiptUrl === 'string' && rawReceiptUrl.trim() ? rawReceiptUrl.trim() : undefined;

    if (amount <= 0) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Không thể ghi nhận giao dịch với số tiền không hợp lệ.',
      );
      return;
    }

    if (placeName && this.financeService) {
      try {
        const existingPlaces = await this.financeService.resolvePlaces(placeName);
        if (existingPlaces.length === 0) {
          const isPending = await this.confirmationService.hasPendingPlace(
            context.senderId,
            placeName,
          );
          if (!isPending) {
            await this.confirmationService.createPendingPlace({
              userId: context.senderId,
              chatId: context.chatId,
              payload: {
                name: placeName,
              },
              rawPrompt: context.text,
            });
          }
        }
      } catch (placeErr) {
        this.logger.warn(
          `Lỗi khi kiểm tra hoặc tạo pending nơi chốn: ${(placeErr as Error).message}`,
        );
      }
    }

    try {
      await this.confirmationService.createPending({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          createdByUserId: context.senderId,
          createdByName: context.displayName || undefined,
          source: 'zalo',
          sourceChatId: context.chatId,
          type,
          amount,
          category,
          note,
          occurredAt: occurredAtStr,
          placeName,
          paymentMethod,
          receiptUrl,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending transaction: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận giao dịch.',
      );
    }
  }
}
