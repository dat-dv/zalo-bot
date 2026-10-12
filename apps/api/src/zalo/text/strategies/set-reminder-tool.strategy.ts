import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { TransactionConfirmationService } from '../../transaction-confirmation.service';

@Injectable()
export class SetReminderToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.SET_REMINDER;
  private readonly logger = new Logger(SetReminderToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const args = context.toolArgs || {};
    const title =
      typeof args.title === 'string' && args.title.trim()
        ? args.title.trim()
        : 'Nhắc nhở công việc';
    const remindAtStr =
      typeof args.remindAt === 'string' && args.remindAt.trim() ? args.remindAt.trim() : '';
    const remindAt = remindAtStr ? new Date(remindAtStr) : new Date(Date.now() + 60 * 60 * 1000);

    try {
      await this.confirmationService.createPendingReminder({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          userId: context.senderId,
          title,
          remindAt: Number.isNaN(remindAt.getTime()) ? new Date(Date.now() + 3600000) : remindAt,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending reminder: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi tạo yêu cầu xác nhận lịch nhắc.',
      );
    }
  }
}
