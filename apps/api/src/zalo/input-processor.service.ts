import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { cleanBotMention } from './text/bot-mention.util';
import { ImageBatchHandler } from './pending-image/image-batch-handler.service';
import { MediaStorageService } from '../receipt-storage/media-storage.service';
import { fetchImageBuffer } from '../common/utils/image-fetcher.util';

@Injectable()
export class InputProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(InputProcessor.name);

  public onModuleDestroy(): void {
    this.imageBatchHandler?.onModuleDestroy();
  }

  constructor(
    private readonly zaloService: ZaloService,
    private readonly textInputService: TextInputService,
    @Optional() private readonly adminBootstrapGuard?: InitialAdminBootstrapGuard,
    @Optional() private readonly grantAccessGuard?: GrantAccessGuard,
    @Optional() private usersService?: UsersService,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private imageBatchHandler?: ImageBatchHandler,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
  ) {
    if (!this.imageBatchHandler) {
      this.imageBatchHandler = new ImageBatchHandler(
        this.zaloService,
        this.pendingImageActionService,
      );
    }

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
    this.logger.log(
      `📥 [InputProcessor] Processing: type=${input.type}, senderId=${input.senderId}, text="${input.text || ''}", imageUrl=${input.imageUrl || ''}`,
    );

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

      case 'video':
        return this.processVideo(input);

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

    const botName =
      this.configService?.get<string>('zalo.botName') ||
      process.env.BOT_NAME ||
      process.env.ZALO_BOT_NAME ||
      'Bot';
    const rawCaption = input.caption || input.text || '';
    const cleanedCaption = cleanBotMention(rawCaption, botName);

    if (cleanedCaption) {
      if (this.imageBatchHandler) {
        await this.imageBatchHandler.addImages(input, targetChatId);
        this.imageBatchHandler.cancelDebounce(input.senderId);
      }
      return this.textInputService.process({
        ...input,
        text: cleanedCaption,
      });
    }

    if (this.imageBatchHandler) {
      return this.imageBatchHandler.handle(input, targetChatId);
    }

    await this.zaloService.sendMessage(
      targetChatId,
      '📸 Đã nhận ảnh từ bạn. Bạn có thể tiếp tục trò chuyện hoặc gửi thêm yêu cầu!',
    );
  }

  private async processVideo(input: AgentInput): Promise<void> {
    const targetChatId = input.chatId || input.senderId;
    this.logger.log(`Received video from ${input.senderId}: ${input.videoUrl}`);

    if (!input.videoUrl) {
      await this.zaloService.sendMessage(
        targetChatId,
        '📹 Đã nhận video từ bạn, nhưng không tìm thấy đường dẫn video.',
      );
      return;
    }

    if (!this.mediaStorageService) {
      await this.zaloService.sendMessage(
        targetChatId,
        '📹 Đã nhận video từ bạn. Tính năng lưu trữ video lên Google Drive & Google Photos đang được kích hoạt.',
      );
      return;
    }

    try {
      await this.zaloService.sendMessage(
        targetChatId,
        '⏳ Đang tải video lên Google Drive & Google Photos dùng chung...',
      );

      const buffer = await fetchImageBuffer(input.videoUrl);
      const note = input.caption || input.text || '';
      const dualResult = await this.mediaStorageService.uploadVideo(input.senderId, buffer, {
        note,
      });
      const summary = this.mediaStorageService.formatUploadSummary(dualResult, 'video');
      await this.zaloService.sendMessage(targetChatId, summary);
    } catch (err) {
      this.logger.error(`Failed to upload video: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        targetChatId,
        `⚠️ Không thể lưu trữ video lên Google: ${(err as Error).message}`,
      );
    }
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

    let linksSection = '';
    let isPermissionMissing = false;

    if (this.mediaStorageService) {
      try {
        const {
          driveLink,
          photosLink,
          isPermissionMissing: permMissing,
        } = await this.mediaStorageService.getVideoStorageLinks();
        if (permMissing) {
          isPermissionMissing = true;
        }
        const lines: string[] = [];
        if (driveLink) lines.push(`• 📁 Google Drive: ${driveLink}`);
        if (photosLink) lines.push(`• 🎬 Google Photos: ${photosLink}`);
        if (lines.length > 0) {
          linksSection = `\n\n📂 ĐƯỜNG DẪN KHO LƯU TRỮ GOOGLE CỦA BOT:\n` + lines.join('\n');
        }
      } catch {
        // Safe fallback if links cannot be retrieved
      }
    }

    let storageGuidance = '';
    if (linksSection) {
      storageGuidance = linksSection;
    } else if (isPermissionMissing) {
      storageGuidance =
        '\n\n⚠️ Lưu ý: Tài khoản Google của Bot hiện CHƯA ĐƯỢC CẤP QUYỀN Google Drive & Photos để tạo kho lưu trữ.' +
        '\n👉 Quản trị viên vui lòng gõ /login để cấp quyền bổ sung.';
    } else {
      storageGuidance =
        '\n\n💡 Bạn có thể gõ /video hoặc /kho để lấy link Google Drive tải video lên nhé!';
    }

    await this.zaloService.sendMessage(
      targetChatId,
      '⚠️ Định dạng này hiện chưa được hỗ trợ (Zalo Bot hiện chỉ hỗ trợ nhận tin nhắn văn bản và hình ảnh, phía Zalo chưa mở tính năng nhận video hoặc file đính kèm cho Bot).\n\n' +
        '💡 Bạn có thể gửi hình ảnh hóa đơn/chứng từ để bot tự động nhận diện.' +
        storageGuidance,
    );
  }
}
