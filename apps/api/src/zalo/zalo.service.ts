import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { GeminiService } from '../gemini/gemini.service';
import { ConversationHistoryService } from '../gemini/services/conversation-history.service';
import { ZALO_API_URLS, ZALO_EVENTS } from './zalo.constants';
import { ZaloWebhookPayload } from './dto/zalo-webhook.dto';

@Injectable()
export class ZaloService implements OnModuleInit {
  private readonly logger = new Logger(ZaloService.name);
  private token: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly geminiService: GeminiService,
    private readonly conversationHistoryService: ConversationHistoryService,
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

  public async processUpdate(update: unknown): Promise<void> {
    if (!update || typeof update !== 'object') {
      this.logger.warn('Received invalid or empty Zalo update.');
      return;
    }

    const payload = update as ZaloWebhookPayload;

    // Handle user unfollow or follow
    if (payload.event_name === ZALO_EVENTS.UNFOLLOW) {
      this.logger.log(`User ${payload.sender?.id} unfollowed official account.`);
      return;
    }

    if (payload.event_name === ZALO_EVENTS.FOLLOW) {
      const followerId = String(payload.sender?.id ?? payload.user_id_by_app ?? '');
      if (followerId) {
        await this.handleStartCommand(followerId, 'bạn');
      }
      return;
    }

    // Resolve chatId / senderId
    const senderId = String(
      payload.sender?.id ??
        payload.message?.chat?.id ??
        payload.message?.from?.id ??
        payload.user_id_by_app ??
        '',
    ).trim();

    const text = (
      payload.message?.text ?? (typeof payload.message === 'string' ? payload.message : '')
    )?.trim();

    const displayName =
      payload.message?.from?.display_name ||
      (payload.sender?.id ? String(payload.sender.id) : 'bạn');

    if (!senderId) {
      this.logger.debug('Received webhook without identifiable sender ID.');
      return;
    }

    if (!text) {
      this.logger.debug(`Received non-text message from ${senderId}`);
      return;
    }

    await this.handleTextMessage(senderId, text, displayName);
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
          '• /ping - Kiểm tra trạng thái hoạt động của bot\n\n' +
          '💡 Hoặc bạn chỉ cần nhắn tin văn bản tự nhiên, AI sẽ tự động phân tích và ghi nhận thu chi/công nợ.',
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
      this.conversationHistoryService.clearHistory(senderId);
      await this.sendMessage(
        senderId,
        '🧹 Đã làm mới ngữ cảnh hội thoại. Bạn có thể bắt đầu phiên trò chuyện mới!',
      );
      return;
    }

    // 6. Conversational input with Gemini AI
    await this.handleAiConversation(senderId, text);
  }

  private async handleStartCommand(senderId: string, displayName: string): Promise<void> {
    await this.sendMessage(
      senderId,
      `👋 Chào ${displayName}! Tôi là chatbot trợ lý tài chính thông minh trên Zalo.\n\n` +
        'Bạn có thể gửi tin nhắn cho tôi bất kỳ lúc nào để:\n' +
        '• Ghi thu chi: "ăn trưa 45k", "tiền lương 15tr"\n' +
        '• Quản lý nợ: "cho Nam vay 500k", "Hùng trả 200k"\n' +
        '• Tra cứu: "hôm nay chi bao nhiêu?", "ai đang nợ tôi?"\n\n' +
        'Gõ /help để xem danh sách các lệnh hỗ trợ.',
    );
  }

  private async handleAiConversation(senderId: string, text: string): Promise<void> {
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

    // Retrieve previous conversation context
    const history = this.conversationHistoryService.getHistory(senderId);
    this.conversationHistoryService.appendUserMessage(senderId, text);

    // Generate response with Gemini AI
    const response = await this.geminiService.chat(text, history, senderId);

    // Preserve model reply in conversation session
    this.conversationHistoryService.appendModelMessage(senderId, response.text);

    // Dispatch reply to Zalo user
    await this.sendMessage(senderId, response.text);
  }
}
