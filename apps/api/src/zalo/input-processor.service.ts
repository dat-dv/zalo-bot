import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZaloService } from './zalo.service';
import { UsersService } from '../users/users.service';
import { AgentInput } from './types/agent-input.type';
import { ZALO_EVENTS } from './zalo.constants';
import { ZaloWebhookEventName } from './dto/zalo-webhook.dto';

@Injectable()
export class InputProcessor {
  private readonly logger = new Logger(InputProcessor.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  public async process(input: AgentInput): Promise<void> {
    if (!input.senderId && input.type !== 'event') {
      this.logger.debug('Received webhook without identifiable sender ID.');
      return;
    }

    switch (input.type) {
      case 'text':
        return this.processText(input);

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

  private async processText(input: AgentInput): Promise<void> {
    const text = input.text?.trim() || '';
    const targetChatId = input.chatId;
    const senderId = input.senderId;
    const displayName = input.displayName;

    // 1. /start command
    if (text === '/start') {
      await this.handleStartCommand(targetChatId, displayName);
      return;
    }

    // 2. /help command
    if (text === '/help') {
      await this.zaloService.sendMessage(
        targetChatId,
        '📖 Danh sách lệnh hỗ trợ:\n\n' +
          '• /start - Bắt đầu & giới thiệu bot\n' +
          '• /help - Hướng dẫn sử dụng\n' +
          '• /echo <nội dung> - Bot phản hồi lại nội dung bạn vừa nhập\n' +
          '• /clear hoặc /reset - Xóa ngữ cảnh hội thoại hiện tại\n' +
          '• /ping - Kiểm tra trạng thái hoạt động của bot',
      );
      return;
    }

    // 3. /echo command
    if (text.startsWith('/echo')) {
      const echoContent = text.slice(5).trim();
      if (echoContent) {
        await this.zaloService.sendMessage(targetChatId, `Bạn vừa nói: ${echoContent}`);
      } else {
        await this.zaloService.sendMessage(
          targetChatId,
          'Hãy nhập gì đó sau lệnh /echo (ví dụ: /echo Xin chào)',
        );
      }
      return;
    }

    // 4. /ping command
    if (text === '/ping') {
      await this.zaloService.sendMessage(
        targetChatId,
        '🏓 Pong! Webhook Zalo Bot đang hoạt động bình thường.',
      );
      return;
    }

    // 5. /reset or /clear command
    if (text === '/reset' || text === '/clear') {
      await this.zaloService.sendMessage(
        targetChatId,
        '🧹 Đã làm mới ngữ cảnh hội thoại. Bạn có thể bắt đầu phiên trò chuyện mới!',
      );
      return;
    }

    // 6. Conversational input
    await this.handleConversationalMessage(targetChatId, senderId, text);
  }

  private async processImage(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.log(`Received image from ${input.senderId}: ${input.imageUrl}`);
    if (input.caption) {
      await this.processText({
        ...input,
        text: input.caption,
      });
      return;
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
    const targetChatId = input.chatId || input.senderId;

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
      if (targetChatId) {
        await this.handleStartCommand(targetChatId, input.displayName);
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

  private async handleStartCommand(targetChatId: string, displayName: string): Promise<void> {
    await this.zaloService.sendMessage(
      targetChatId,
      `👋 Chào ${displayName}! Tôi là chatbot trên Zalo.\n\n` +
        'Gõ /help để xem danh sách các lệnh hỗ trợ.',
    );
  }

  private async handleConversationalMessage(
    targetChatId: string,
    senderId: string,
    text: string,
  ): Promise<void> {
    const allowedIds = this.configService.get<string[]>('zalo.allowedUserIds') || [];
    if (allowedIds.length > 0 && !this.usersService.isAllowed(senderId)) {
      this.logger.warn(`Unauthorized Zalo user message attempt from ${senderId}`);
      await this.zaloService.sendMessage(
        targetChatId,
        'Xin lỗi, tài khoản của bạn chưa được cấp quyền sử dụng trợ lý này.',
      );
      return;
    }

    const cooldown = this.usersService.checkCooldown(senderId);
    if (!cooldown.allowed) {
      await this.zaloService.sendMessage(targetChatId, cooldown.reason || 'Vui lòng gửi chậm lại.');
      return;
    }

    await this.usersService.upsertUser(senderId);

    await this.zaloService.sendMessage(
      targetChatId,
      `Đã nhận tin nhắn: "${text}". Gõ /help để xem danh sách các lệnh hỗ trợ.`,
    );
  }
}
