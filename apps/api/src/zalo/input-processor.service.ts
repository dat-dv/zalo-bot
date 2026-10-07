import { Injectable, Logger } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import { TextInputService } from './text/text-input.service';
import { TextToolType } from './text/text-tool.enum';
import { AgentInput } from './types/agent-input.type';
import { ZALO_EVENTS } from './zalo.constants';
import { ZaloWebhookEventName } from './dto/zalo-webhook.dto';

@Injectable()
export class InputProcessor {
  private readonly logger = new Logger(InputProcessor.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly textInputService: TextInputService,
  ) {}

  public async process(input: AgentInput): Promise<void> {
    if (!input.senderId && input.type !== 'event') {
      this.logger.debug('Received webhook without identifiable sender ID.');
      return;
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

      case 'event':
        return this.processEvent(input);

      case 'unsupported':
      default:
        return this.processUnsupported(input);
    }
  }

  private async processImage(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.log(`Received image from ${input.senderId}: ${input.imageUrl}`);
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
