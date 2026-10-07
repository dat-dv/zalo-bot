import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { ZALO_API_URLS, ZALO_EVENTS } from './zalo.constants';
import {
  ZaloWebhookPayloadDto,
  ZaloWebhookEventName,
  normalizeZaloWebhookPayload,
} from './dto/zalo-webhook.dto';

@Injectable()
export class ZaloService implements OnModuleInit {
  private readonly logger = new Logger(ZaloService.name);
  private token: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.token = this.configService.get<string>('zalo.botToken') || null;
    if (!this.token) {
      this.logger.warn('ZALO_BOT_TOKEN is not configured.');
    }
  }

  public onModuleInit() {
    const webhookUrl = this.configService.get<string>('zalo.webhookUrl');
    if (webhookUrl) {
      this.logger.log(`Zalo webhook configured for endpoint: ${webhookUrl}`);
    }
  }

  public async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const targetUserId = String(chatId);
    if (!this.token) {
      this.logger.warn(`Zalo token not configured. Outgoing message to ${targetUserId}: "${text}"`);
      return false;
    }

    try {
      const response = await fetch(ZALO_API_URLS.SEND_MESSAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.token,
        },
        body: JSON.stringify({
          recipient: {
            user_id: targetUserId,
          },
          message: {
            text,
          },
        }),
      });

      const data = (await response.json().catch((): null => null)) as {
        error?: number;
        message?: string;
      } | null;

      if (!response.ok || (data && data.error !== 0 && data.error !== undefined)) {
        this.logger.error(
          `Failed to send Zalo message to ${targetUserId}: ${JSON.stringify(data || response.statusText)}`,
        );
        return false;
      }

      this.logger.log(`Successfully sent message to Zalo user ${targetUserId}`);
      return true;
    } catch (err) {
      this.logger.error(`Error sending Zalo message to ${targetUserId}: ${(err as Error).message}`);
      return false;
    }
  }

  public async processInput(update: unknown, secretToken?: string): Promise<void> {
    if (!update || typeof update !== 'object') {
      this.logger.warn('Received invalid or empty Zalo update.');
      return;
    }

    // Verify secret token if configured
    const configuredSecretToken = this.configService.get<string>('zalo.secretToken');
    if (configuredSecretToken && secretToken !== configuredSecretToken) {
      this.logger.warn('Unauthorized Zalo webhook request: invalid X-Bot-Api-Secret-Token.');
      return;
    }

    const payload = update as ZaloWebhookPayloadDto;
    const normalized = normalizeZaloWebhookPayload(payload);

    // Handle user unfollow or follow (Legacy OA events)
    if (normalized.eventName === ZaloWebhookEventName.UNFOLLOW) {
      this.logger.log(`User ${normalized.senderId} unfollowed official account.`);
      return;
    }

    if (normalized.eventName === ZaloWebhookEventName.FOLLOW) {
      if (normalized.senderId) {
        await this.handleStartCommand(normalized.senderId, normalized.displayName);
      }
      return;
    }

    if (!normalized.senderId) {
      this.logger.debug('Received webhook without identifiable sender ID.');
      return;
    }

    // Handle unsupported message event (special user groups or unsupported types)
    if (normalized.isUnsupported) {
      this.logger.debug(`Received unsupported message event from ${normalized.senderId}`);
      await this.sendMessage(
        normalized.senderId,
        'Tin nhắn của bạn hiện chưa được hỗ trợ xử lý trên hệ thống trợ lý.',
      );
      return;
    }

    // Handle image message event
    if (normalized.imageUrl) {
      this.logger.log(`Received image from ${normalized.senderId}: ${normalized.imageUrl}`);
      if (normalized.caption) {
        await this.handleTextMessage(
          normalized.senderId,
          normalized.caption,
          normalized.displayName,
        );
      } else {
        await this.sendMessage(
          normalized.senderId,
          '📸 Đã nhận ảnh từ bạn. Hệ thống đang sẵn sàng xử lý nội dung hóa đơn!',
        );
      }
      return;
    }

    // Handle text message
    if (normalized.text) {
      await this.handleTextMessage(normalized.senderId, normalized.text, normalized.displayName);
      return;
    }

    this.logger.debug(
      `Received non-text message (${normalized.eventName}) from ${normalized.senderId}`,
    );
  }

  public async processUpdate(update: unknown, secretToken?: string): Promise<void> {
    return this.processInput(update, secretToken);
  }

  private async handleTextMessage(
    senderId: string,
    text: string,
    displayName: string,
  ): Promise<void> {
    // 1. /start command
    if (text === '/start') {
      await this.handleStartCommand(senderId, displayName);
      return;
    }

    // 2. /help command
    if (text === '/help') {
      await this.sendMessage(
        senderId,
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
        await this.sendMessage(senderId, `Bạn vừa nói: ${echoContent}`);
      } else {
        await this.sendMessage(senderId, 'Hãy nhập gì đó sau lệnh /echo (ví dụ: /echo Xin chào)');
      }
      return;
    }

    // 4. /ping command
    if (text === '/ping') {
      await this.sendMessage(senderId, '🏓 Pong! Webhook Zalo Bot đang hoạt động bình thường.');
      return;
    }

    // 5. /reset or /clear command
    if (text === '/reset' || text === '/clear') {
      await this.sendMessage(
        senderId,
        '🧹 Đã làm mới ngữ cảnh hội thoại. Bạn có thể bắt đầu phiên trò chuyện mới!',
      );
      return;
    }

    // 6. Conversational input
    await this.handleConversationalMessage(senderId, text);
  }

  private async handleStartCommand(senderId: string, displayName: string): Promise<void> {
    await this.sendMessage(
      senderId,
      `👋 Chào ${displayName}! Tôi là chatbot trên Zalo.\n\n` +
        'Gõ /help để xem danh sách các lệnh hỗ trợ.',
    );
  }

  private async handleConversationalMessage(senderId: string, text: string): Promise<void> {
    // Check allowed users if configured
    const allowedIds = this.configService.get<string[]>('zalo.allowedUserIds') || [];
    if (allowedIds.length > 0 && !this.usersService.isAllowed(senderId)) {
      this.logger.warn(`Unauthorized Zalo user message attempt from ${senderId}`);
      await this.sendMessage(
        senderId,
        'Xin lỗi, tài khoản của bạn chưa được cấp quyền sử dụng trợ lý này.',
      );
      return;
    }

    // Rate limiting cooldown check
    const cooldown = this.usersService.checkCooldown(senderId);
    if (!cooldown.allowed) {
      await this.sendMessage(senderId, cooldown.reason || 'Vui lòng gửi chậm lại.');
      return;
    }

    // Ensure user record in database
    await this.usersService.upsertUser(senderId);

    // Dispatch reply to Zalo user
    await this.sendMessage(
      senderId,
      `Đã nhận tin nhắn: "${text}". Gõ /help để xem danh sách các lệnh hỗ trợ.`,
    );
  }
}
