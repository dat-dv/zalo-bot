import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';
import { ZaloWebhookPayload } from './dto/zalo-webhook.dto';
import { ZALO_API_URLS, ZALO_EVENTS } from './zalo.constants';
import { UsersService } from '../users/users.service';
import { GeminiService } from '../gemini/gemini.service';
import { ConversationHistoryService } from '../gemini/services/conversation-history.service';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly geminiService: GeminiService,
    private readonly conversationHistoryService: ConversationHistoryService,
  ) {}

  /**
   * Verify Zalo webhook signature if secret key is configured.
   */
  public verifySignature(
    signatureHeader: string | undefined,
    body: Record<string, unknown> | string,
    timestamp?: string | number,
  ): boolean {
    const secretKey =
      this.configService.get<string>('zalo.oaSecretKey') ||
      this.configService.get<string>('zalo.secretKey') ||
      this.configService.get<string>('zalo.webhookSecret');

    if (!secretKey) {
      // Secret key not configured: allow all in dev/test environment with warning
      this.logger.debug('Zalo secret key not configured; skipping signature verification.');
      return true;
    }

    if (!signatureHeader) {
      this.logger.warn('Missing Zalo signature header in webhook request.');
      return false;
    }

    try {
      const appId =
        this.configService.get<string>('zalo.appId') ||
        (typeof body === 'object' && body !== null ? (body as Record<string, unknown>).app_id : '');
      const rawData = typeof body === 'string' ? body : JSON.stringify(body);
      const ts = timestamp ? String(timestamp) : '';

      // Zalo OA signature algorithm: sha256(appId + rawData + timestamp + secretKey)
      const expectedSig = createHash('sha256')
        .update(`${appId}${rawData}${ts}${secretKey}`)
        .digest('hex');

      const expectedHmac = createHmac('sha256', secretKey).update(rawData).digest('hex');

      const cleanSig = signatureHeader.replace(/^mac=/i, '').trim();

      const isValid =
        cleanSig.toLowerCase() === expectedSig.toLowerCase() ||
        cleanSig.toLowerCase() === expectedHmac.toLowerCase();

      if (!isValid) {
        this.logger.warn(`Invalid Zalo webhook signature. Received: ${cleanSig}`);
      }
      return isValid;
    } catch (err) {
      this.logger.error(`Error verifying Zalo signature: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Send text message back to user via Zalo OA OpenAPI (Customer Service message)
   */
  public async sendMessage(recipientId: string, text: string): Promise<boolean> {
    const accessToken = this.configService.get<string>('zalo.accessToken');

    if (!accessToken) {
      this.logger.warn(
        `ZALO_ACCESS_TOKEN is not configured. Outgoing message to ${recipientId} logged: "${text}"`,
      );
      return false;
    }

    try {
      const response = await fetch(ZALO_API_URLS.SEND_MESSAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: accessToken,
        },
        body: JSON.stringify({
          recipient: {
            user_id: recipientId,
          },
          message: {
            text,
          },
        }),
      });

      const result = (await response.json()) as { error: number; message: string };

      if (result.error !== 0) {
        this.logger.error(
          `Failed to send Zalo message to user ${recipientId}. Error code ${result.error}: ${result.message}`,
        );
        return false;
      }

      this.logger.log(`Successfully sent Zalo message to user ${recipientId}`);
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Exception while sending Zalo message: ${err.message}`);
      return false;
    }
  }

  /**
   * Handle incoming event from Zalo OA Webhook
   */
  public async handleWebhookEvent(
    payload: ZaloWebhookPayload,
  ): Promise<{ error: number; message: string }> {
    const eventName = payload.event_name;
    const senderId = payload.sender?.id;

    this.logger.log(`Received Zalo webhook event: "${eventName}" from sender: "${senderId}"`);

    if (!senderId) {
      return { error: 0, message: 'Event ignored: Missing sender id' };
    }

    switch (eventName) {
      case ZALO_EVENTS.USER_SEND_TEXT:
        await this.handleUserSendText(senderId, payload);
        break;

      case ZALO_EVENTS.FOLLOW:
        await this.handleUserFollow(senderId);
        break;

      case ZALO_EVENTS.UNFOLLOW:
        this.logger.log(`User ${senderId} unfollowed Zalo Official Account.`);
        break;

      case ZALO_EVENTS.USER_SEND_IMAGE:
        await this.sendMessage(
          senderId,
          'Tôi đã nhận được hình ảnh của bạn. Hiện tại hệ thống đang tiếp tục nâng cấp để xử lý hình ảnh tối ưu hơn.',
        );
        break;

      default:
        this.logger.debug(`Unhandled event: ${eventName}`);
        break;
    }

    return { error: 0, message: 'Success' };
  }

  private async handleUserSendText(
    senderId: string,
    payload: ZaloWebhookPayload,
  ): Promise<void> {
    const userText = payload.message?.text?.trim();
    if (!userText) {
      return;
    }

    // Check allowed users if allowed list is enforced
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
    this.conversationHistoryService.appendUserMessage(senderId, userText);

    // Generate response with Gemini AI
    const response = await this.geminiService.chat(userText, history, senderId);

    // Preserve model reply in conversation session
    this.conversationHistoryService.appendModelMessage(senderId, response.text);

    // Dispatch reply to Zalo user
    await this.sendMessage(senderId, response.text);
  }

  private async handleUserFollow(senderId: string): Promise<void> {
    await this.usersService.upsertUser(senderId);
    await this.sendMessage(
      senderId,
      'Xin chào! Cảm ơn bạn đã quan tâm. Tôi là trợ lý ảo cá nhân thông minh của bạn. Hãy gửi tin nhắn cho tôi bất kỳ lúc nào bạn cần nhé! 🚀',
    );
  }
}
