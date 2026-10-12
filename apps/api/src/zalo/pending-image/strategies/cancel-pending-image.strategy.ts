import { Injectable, Logger } from '@nestjs/common';
import { ZaloService } from '../../zalo.service';
import { PendingImageActionService } from '../../pending-image-action.service';
import { PendingImageContext, PendingImageStrategy } from '../pending-image.interface';

@Injectable()
export class CancelPendingImageStrategy implements PendingImageStrategy {
  private readonly logger = new Logger(CancelPendingImageStrategy.name);

  private readonly cancelRegex =
    /^(?:hủy|huỷ|huy|cancel|bỏ\s*qua|bo\s*qua|dừng|dung|không|khong|ko)(?:\s+(?:ảnh|anh|nhé|nhe|ạ|a))?$/i;

  constructor(
    private readonly zaloService: ZaloService,
    private readonly pendingImageActionService: PendingImageActionService,
  ) {}

  public canHandle(text: string): boolean {
    return this.cancelRegex.test(text.trim());
  }

  public async execute(context: PendingImageContext): Promise<boolean> {
    this.logger.log(`User ${context.senderId} canceled pending image action.`);
    await this.pendingImageActionService.clearPending(context.senderId);
    await this.zaloService.sendMessage(context.chatId, '❌ Đã hủy yêu cầu xử lý hình ảnh.');
    return true;
  }
}
