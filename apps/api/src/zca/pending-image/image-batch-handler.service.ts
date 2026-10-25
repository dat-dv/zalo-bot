import { Injectable, Logger, OnModuleDestroy, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from '../zca.service';
import { sendChatText, type ChatMessenger } from '../chat-messenger.util';
import { PendingImageActionService } from './pending-image-action.service';
import { AgentInput } from '../../types/agent-input.type';

@Injectable()
export class ImageBatchHandler implements OnModuleDestroy {
  private readonly logger = new Logger(ImageBatchHandler.name);
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

  public debounceDelayMs = 1000; // 1 giây

  constructor(
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ChatMessenger,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
  ) {}

  public onModuleDestroy(): void {
    this.clearAllTimers();
  }

  public clearAllTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  public cancelDebounce(senderId: string): void {
    const timer = this.debounceTimers.get(senderId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(senderId);
    }
  }

  /**
   * Thêm các URL ảnh trong input vào danh sách pending image của người dùng
   */
  public async addImages(input: AgentInput, targetChatId: string): Promise<void> {
    if (!this.pendingImageActionService || !input.senderId) return;

    const incomingUrls: string[] = input.imageUrls?.length
      ? input.imageUrls
      : input.imageUrl
        ? [input.imageUrl]
        : [];

    for (const url of incomingUrls) {
      await this.pendingImageActionService.addPendingImage(input.senderId, {
        userId: input.senderId,
        chatId: targetChatId,
        receiptUrl: url,
      });
    }
  }

  private async notify(targetChatId: string, text: string): Promise<void> {
    await sendChatText(this.zcaService, targetChatId, text);
  }

  /**
   * Xử lý gom ảnh và kích hoạt timer debounce.
   * Nếu có nhiều ảnh gửi liên tiếp (ZCA nhận từng ảnh thành tin riêng lẻ), gộp vào batch và chỉ gửi 1 thông báo.
   */
  public async handle(input: AgentInput, targetChatId: string): Promise<void> {
    if (!this.pendingImageActionService) {
      await this.notify(targetChatId, '📸 Đã nhận ảnh.');
      return;
    }

    await this.addImages(input, targetChatId);

    // Reset debounce timer cho senderId này
    this.cancelDebounce(input.senderId);

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(input.senderId);
      const pending = await this.pendingImageActionService?.getPending(input.senderId);
      if (!pending) return;

      const count = pending.receiptUrls?.length || 1;
      const countText = count > 1 ? `${count} ảnh` : 'ảnh';

      this.logger.log(`Debounce fired: notifying user ${input.senderId} for ${count} image(s).`);

      await this.notify(
        targetChatId,
        `Đã nhận ${countText}. Làm gì với ảnh?\n` +
          `1 hoặc "1 <ghi chú>": ghi hoá đơn (vd "1 Ăn trưa Highlands")\n` +
          `2: lưu lên Google Drive và Google Photos\n` +
          `Nhắn "huỷ" để bỏ qua ảnh.`,
      );
    }, this.debounceDelayMs);

    timer.unref();
    this.debounceTimers.set(input.senderId, timer);
  }
}
