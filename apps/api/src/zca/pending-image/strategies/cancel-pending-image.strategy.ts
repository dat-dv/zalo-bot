import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../../zca.service';
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
    private readonly zcaService?:
      | ZcaService
      | {
          sendMessage?: (a: unknown, b?: unknown) => Promise<unknown>;
          sendMessageToChat?: (chatId: string | number, text: string) => Promise<unknown>;
        },
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
    if (this.zcaService) {
      if (
        'sendMessageToChat' in this.zcaService &&
        typeof this.zcaService.sendMessageToChat === 'function'
      ) {
        await this.zcaService.sendMessageToChat(
          context.chatId,
          '❌ Đã hủy yêu cầu xử lý hình ảnh.',
        );
      } else if (typeof (this.zcaService as any).isLoggedIn === 'function') {
        await this.zcaService.sendMessage('❌ Đã hủy yêu cầu xử lý hình ảnh.', context.chatId);
      } else if (typeof this.zcaService.sendMessage === 'function') {
        await (
          this.zcaService as unknown as { sendMessage(c: string, t: string): Promise<unknown> }
        ).sendMessage(context.chatId, '❌ Đã hủy yêu cầu xử lý hình ảnh.');
      }
    }
    return true;
  }
}
