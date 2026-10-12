import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class CreatePlaceToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.CREATE_PLACE;
  private readonly logger = new Logger(CreatePlaceToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly financeService?: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs ?? {};

    const rawName =
      typeof args.name === 'object' && args.name !== null
        ? ((args.name as Record<string, unknown>).name ??
          (args.name as Record<string, unknown>).value)
        : args.name;
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : '';

    if (!name) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Tên nơi chốn / địa điểm không được để trống.',
      );
      return;
    }

    if (this.financeService) {
      const existing = await this.financeService.resolvePlaces(context.senderId, name);
      if (existing.length > 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          `ℹ️ Nơi chốn "${name}" đã tồn tại trong danh bạ nơi chốn của bạn.`,
        );
        return;
      }
    }

    const alreadyPending = await this.confirmationService.hasPendingPlace(context.senderId, name);
    if (alreadyPending) {
      this.logger.debug(
        `Place "${name}" already has a pending confirmation for user ${context.senderId}`,
      );
      return;
    }

    try {
      await this.confirmationService.createPendingPlace({
        userId: context.senderId,
        chatId: context.chatId,
        payload: {
          userId: context.senderId,
          name,
        },
        rawPrompt: context.text,
      });
    } catch (err) {
      this.logger.error(`Failed to create pending place: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận nơi chốn.',
      );
    }
  }
}
