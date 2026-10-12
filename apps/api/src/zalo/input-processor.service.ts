import { Injectable, Logger, Optional } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import { TextInputService } from './text/text-input.service';
import { TextToolType } from './text/text-tool.enum';
import { AgentInput } from './types/agent-input.type';
import { ZALO_EVENTS } from './zalo.constants';
import { ZaloWebhookEventName } from './dto/zalo-webhook.dto';
import { UsersService } from '../users/users.service';
import { InitialAdminBootstrapGuard } from './guards/initial-admin-bootstrap.guard';
import { GrantAccessGuard } from './guards/grant-access.guard';
import { PendingImageActionService } from './pending-image-action.service';
import { ReceiptImageStorageService } from '../receipt-storage/receipt-image-storage.service';

@Injectable()
export class InputProcessor {
  private readonly logger = new Logger(InputProcessor.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly textInputService: TextInputService,
    @Optional() private readonly adminBootstrapGuard?: InitialAdminBootstrapGuard,
    @Optional() private readonly grantAccessGuard?: GrantAccessGuard,
    @Optional() private usersService?: UsersService,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly receiptStorageService?: ReceiptImageStorageService,
  ) {
    // Gracefully handle legacy test calls passing usersService as 3rd parameter
    if (
      adminBootstrapGuard &&
      typeof (adminBootstrapGuard as unknown as UsersService).checkCooldown === 'function'
    ) {
      this.usersService = adminBootstrapGuard as unknown as UsersService;
      this.adminBootstrapGuard = undefined;
    }
  }

  public async process(input: AgentInput): Promise<void> {
    if (!input.senderId && input.type !== 'event') {
      this.logger.debug('Received webhook without identifiable sender ID.');
      return;
    }

    // Bỏ qua tin nhắn do chính bot gửi ra để tránh vòng lặp vô hạn
    if (input.isBot) {
      this.logger.debug(`Ignoring message from bot itself (senderId: ${input.senderId})`);
      return;
    }

    if (input.type === 'event') {
      return this.processEvent(input);
    }

    // Guard 1: Nếu chưa có user nào trong whitelist/admin thì phong admin cho người đầu tiên
    if (this.adminBootstrapGuard && typeof this.adminBootstrapGuard.canActivate === 'function') {
      const isFirstAdminHandled = await this.adminBootstrapGuard.canActivate(input);
      if (isFirstAdminHandled) {
        return;
      }
    }

    // Guard 2: Kiểm tra quyền truy cập (isGrantAccess / Whitelist). Nếu chưa được cấp quyền thì reject & gửi ID
    if (this.grantAccessGuard && typeof this.grantAccessGuard.canActivate === 'function') {
      const canAccess = await this.grantAccessGuard.canActivate(input);
      if (!canAccess) {
        return;
      }
    }

    // Khi đã đi qua được cả 2 Interceptor (được cấp quyền):
    // Kiểm tra Cooldown / Rate-limiting
    if (this.usersService) {
      const cooldown = this.usersService.checkCooldown(input.senderId);
      if (!cooldown.allowed) {
        const targetChatId = input.chatId || input.senderId;
        await this.zaloService.sendMessage(
          targetChatId,
          cooldown.reason || 'Vui lòng gửi chậm lại.',
        );
        return;
      }
    }

    switch (input.type) {
      case 'text':
        return this.textInputService.process(input);

      case 'image':
        return this.processImage(input);

      case 'voice':
        return this.processVoice(input);

      case 'sticker':
        return this.processSticker(input);

      case 'unsupported':
      default:
        return this.processUnsupported(input);
    }
  }

  private async processImage(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.log(`Received image from ${input.senderId}: ${input.imageUrl}`);

    let receiptUrl: string | undefined;
    if (this.receiptStorageService && input.imageUrl && input.senderId) {
      try {
        const res = await fetch(input.imageUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          receiptUrl = await this.receiptStorageService.store(input.senderId, buffer);
        }
      } catch (err) {
        this.logger.warn(`Failed to download and store receipt image: ${(err as Error).message}`);
      }
    }

    if (receiptUrl && this.pendingImageActionService && input.senderId) {
      await this.pendingImageActionService.setPending(input.senderId, {
        userId: input.senderId,
        chatId: targetChatId,
        receiptUrl,
      });

      if (input.caption?.trim()) {
        return this.textInputService.process({
          ...input,
          text: input.caption.trim(),
        });
      }

      await this.zaloService.sendMessage(
        targetChatId,
        `📸 Tôi đã nhận được hình ảnh của bạn! Bạn muốn xử lý như thế nào?

1️⃣ Tạo bill / Ghi nhận chi tiêu từ hóa đơn này
   👉 Trả lời: "1" hoặc "1 <ghi chú>" (Ví dụ: "1 Ăn trưa Highlands")
2️⃣ Lưu trữ ảnh lên Google Drive
   👉 Trả lời: "2"

💡 Bạn cũng có thể gõ "hủy" để bỏ qua ảnh này.`,
      );
      return;
    }

    if (input.caption) {
      return this.textInputService.process({
        ...input,
        text: input.caption,
      });
    }

    await this.zaloService.sendMessage(
      targetChatId,
      '📸 Đã nhận ảnh từ bạn. Hệ thống đang sẵn sàng xử lý nội dung hóa đơn!',
    );
  }

  private async processVoice(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.log(`Received voice message from ${input.senderId}: ${input.voiceUrl}`);
    await this.zaloService.sendMessage(
      targetChatId,
      '🎙️ Đã nhận tin nhắn thoại. Tính năng xử lý giọng nói đang được phát triển.',
    );
  }

  private async processSticker(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.debug(`Received sticker from ${input.senderId}: ${input.stickerUrl}`);
    await this.zaloService.sendMessage(targetChatId, '😊 Cảm ơn bạn đã gửi sticker!');
  }

  private async processEvent(input: AgentInput): Promise<void> {
    const eventName = String(input.eventName || '');

    if (
      eventName === String(ZALO_EVENTS.UNFOLLOW) ||
      eventName === String(ZaloWebhookEventName.UNFOLLOW)
    ) {
      this.logger.log(`User ${input.senderId} unfollowed official account.`);
      return;
    }

    if (
      eventName === String(ZALO_EVENTS.FOLLOW) ||
      eventName === String(ZaloWebhookEventName.FOLLOW)
    ) {
      if (input.senderId) {
        await this.textInputService.process(input, TextToolType.START);
      }
      return;
    }
  }

  private async processUnsupported(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.debug(`Received unsupported message event from ${input.senderId}`);
    await this.zaloService.sendMessage(
      targetChatId,
      'Tin nhắn của bạn hiện chưa được hỗ trợ xử lý trên hệ thống trợ lý.',
    );
  }
}
