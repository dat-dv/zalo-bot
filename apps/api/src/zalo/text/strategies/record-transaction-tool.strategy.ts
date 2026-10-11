import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';
import { parseAmount } from '../../../llm/utils/tool-arguments.util';

@Injectable()
export class RecordTransactionToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.RECORD_TRANSACTION;
  private readonly logger = new Logger(RecordTransactionToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly confirmationService: TransactionConfirmationService,
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

    if (amount <= 0) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không thể ghi nhận giao dịch với số tiền không hợp lệ.',
      );
      return;
    }

    try {
      await this.confirmationService.createPending({
        userId: context.senderId,
        chatId: context.chatId,
        payload: {
          userId: context.senderId,
          type,
          amount,
          category,
          note,
          occurredAt: occurredAtStr,
          placeName,
          paymentMethod,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending transaction: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận giao dịch.',
      );
    }
  }
}
