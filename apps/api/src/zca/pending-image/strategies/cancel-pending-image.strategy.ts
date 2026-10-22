import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../../zca.service';
import { sendChatText, type ChatMessenger } from '../../chat-messenger.util';
import { PendingImageActionService } from '../pending-image-action.service';
import { PendingImageContext, PendingImageStrategy } from '../pending-image.interface';

@Injectable()
export class CancelPendingImageStrategy implements PendingImageStrategy {
  private readonly logger = new Logger(CancelPendingImageStrategy.name);

  private readonly cancelRegex =
    /^(?:hủy|huỷ|huy|cancel|bỏ\s*qua|bo\s*qua|dừng|dung|không|khong|ko)(?:\s+(?:ảnh|anh|nhé|nhe|ạ|a))?$/i;

  constructor(
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ChatMessenger,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
  ) {}

  public canHandle(text: string): boolean {
    return this.cancelRegex.test(text.trim());
  }

  public async execute(context: PendingImageContext): Promise<boolean> {
    this.logger.log(`User ${context.senderId} canceled pending image action.`);
    if (this.pendingImageActionService) {
      await this.pendingImageActionService.clearPending(context.senderId);
    }
    await sendChatText(this.zcaService, context.chatId, '❌ Đã hủy yêu cầu xử lý hình ảnh.');
    return true;
  }
}
