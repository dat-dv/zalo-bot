import {
  Injectable,
  Logger,
  Optional,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThreadConfigService } from './thread-config.service';
import type { TransactionConfirmationService } from './confirmation/transaction-confirmation.service';
import { MediaStorageService } from '../receipt-storage/media-storage.service';
import type { TextInputService } from '../zalo/text/text-input.service';
import type { ZcaService } from './zca.service';
import type { ZcaPlugin } from './zca.interfaces';
import {
  ThreadType,
  type API,
  type Message,
  type Reaction,
  type GetGroupChatHistoryResponse,
  getMessageText,
  isMentioned,
} from './shapes';
import { fetchImageBuffer } from '../common/utils/image-fetcher.util';
import type { AgentInput } from '../types/agent-input.type';
import type {
  ThreadBotConfig,
  ThreadDirectInteractionConfig,
  SyncThreadMediaDto,
  SyncThreadMediaResponse,
} from '@zalobot/contracts';
import { RedisService } from '../redis/redis.service';
import type { InitialAdminBootstrapGuard } from './guards/initial-admin-bootstrap.guard';
import type { GrantAccessGuard } from './guards/grant-access.guard';
import type { UsersService } from '../users/users.service';
import type { PendingImageActionDispatcher } from './pending-image/pending-image-dispatcher.service';
import type { ImageBatchHandler } from './pending-image/image-batch-handler.service';
import type { OcrService } from '../ocr/ocr.service';
import { cleanBotMention } from '../zalo/text/bot-mention.util';

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return JSON.stringify(err);
}

export function extractMediaMeta(content: unknown): { url: string | null; filename?: string } {
  if (!content) return { url: null };
  if (typeof content === 'string') {
    try {
      const parsed: unknown = JSON.parse(content);
      return extractMediaMeta(parsed);
    } catch {
      if (content.startsWith('http://') || content.startsWith('https://')) {
        return { url: content };
      }
      return { url: null };
    }
  }
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    const url =
      (typeof obj.href === 'string' && obj.href) ||
      (typeof obj.url === 'string' && obj.url) ||
      (typeof obj.hdUrl === 'string' && obj.hdUrl) ||
      (typeof obj.thumb === 'string' && obj.thumb) ||
      (typeof obj.link === 'string' && obj.link) ||
      (typeof obj.voiceUrl === 'string' && obj.voiceUrl) ||
      (typeof obj.fileUrl === 'string' && obj.fileUrl) ||
      null;

    const filename =
      (typeof obj.title === 'string' && obj.title) ||
      (typeof obj.fileName === 'string' && obj.fileName) ||
      (typeof obj.name === 'string' && obj.name) ||
      undefined;

    return { url, filename };
  }
  return { url: null };
}

export function extractMediaUrl(content: unknown): string | null {
  return extractMediaMeta(content).url;
}

export function getCaptionOrText(message: Message): string {
  const msgType = message.data?.msgType;
  const content = message.data?.content;
  if (msgType === 'chat.photo' || msgType === 'chat.video.msg' || msgType === 'sharefile') {
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
          const obj = parsed as Record<string, unknown>;
          const title = obj.title;
          const desc = obj.description;
          const txt = obj.text;
          if (typeof title === 'string' && title.trim()) return title.trim();
          if (typeof desc === 'string' && desc.trim()) return desc.trim();
          if (typeof txt === 'string' && txt.trim()) return txt.trim();
          return '';
        }
      } catch {
        // Not a JSON string
      }
    } else if (content && typeof content === 'object') {
      const obj = content as Record<string, unknown>;
      if (typeof obj.title === 'string' && obj.title.trim()) return obj.title.trim();
      if (typeof obj.description === 'string' && obj.description.trim()) return obj.description.trim();
      if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
      return '';
    }
  }
  return getMessageText(message);
}

@Injectable()
export class ZcaBotFeatureService implements ZcaPlugin, OnModuleInit, OnModuleDestroy {
  public readonly name = 'zca-bot-feature-plugin';
  public readonly description =
    'Orchestrates modular features per listened thread (Media backup to Drive, Expense tracking, Calendar creation, Reaction confirmation)';
  private readonly logger = new Logger(ZcaBotFeatureService.name);

  private mediaStorageService?: MediaStorageService;
  private confirmationService?: TransactionConfirmationService;
  private textInputService?: TextInputService;
  private zcaService?: ZcaService;
  private adminBootstrapGuard?: InitialAdminBootstrapGuard;
  private grantAccessGuard?: GrantAccessGuard;
  private usersService?: UsersService;
  private pendingImageDispatcher?: PendingImageActionDispatcher;
  private imageBatchHandler?: ImageBatchHandler;
  private ocrService?: OcrService;
  private readonly recentMessageBuffer = new Map<
    string,
    Array<{ data?: Record<string, unknown> }>
  >();

  constructor(
    private readonly threadConfigService: ThreadConfigService,
    @Optional()
    @Inject(MediaStorageService)
    mediaStorageServiceOrConfirmation?: MediaStorageService | TransactionConfirmationService,
    @Optional() @Inject(ModuleRef) private readonly moduleRef?: ModuleRef,
    @Optional() confirmationService?: TransactionConfirmationService,
    @Optional() textInputService?: TextInputService,
    @Optional() private configService?: ConfigService,
    @Optional() private redisService?: RedisService,
    @Optional() adminBootstrapGuard?: InitialAdminBootstrapGuard,
    @Optional() grantAccessGuard?: GrantAccessGuard,
    @Optional() usersService?: UsersService,
    @Optional() pendingImageDispatcher?: PendingImageActionDispatcher,
    @Optional() imageBatchHandler?: ImageBatchHandler,
    @Optional() ocrService?: OcrService,
  ) {
    if (mediaStorageServiceOrConfirmation) {
      if ('handleReaction' in mediaStorageServiceOrConfirmation) {
        this.confirmationService = mediaStorageServiceOrConfirmation;
      } else {
        this.mediaStorageService = mediaStorageServiceOrConfirmation;
      }
    }
    if (confirmationService) {
      this.confirmationService = confirmationService;
    }
    if (textInputService) {
      this.textInputService = textInputService;
    }
    if (adminBootstrapGuard) {
      this.adminBootstrapGuard = adminBootstrapGuard;
    }
    if (grantAccessGuard) {
      this.grantAccessGuard = grantAccessGuard;
    }
    if (usersService) {
      this.usersService = usersService;
    }
    if (pendingImageDispatcher) {
      this.pendingImageDispatcher = pendingImageDispatcher;
    }
    if (imageBatchHandler) {
      this.imageBatchHandler = imageBatchHandler;
    }
    if (ocrService) {
      this.ocrService = ocrService;
    }
  }

  public setConfirmationService(service: TransactionConfirmationService): void {
    this.confirmationService = service;
  }

  public setTextInputService(service: TextInputService): void {
    this.textInputService = service;
  }

  public setZcaService(service: ZcaService): void {
    this.zcaService = service;
  }

  public setConfigService(service: ConfigService): void {
    this.configService = service;
  }

  public setRedisService(service: RedisService): void {
    this.redisService = service;
  }

  public setAdminBootstrapGuard(guard: InitialAdminBootstrapGuard): void {
    this.adminBootstrapGuard = guard;
  }

  public setGrantAccessGuard(guard: GrantAccessGuard): void {
    this.grantAccessGuard = guard;
  }

  public setUsersService(service: UsersService): void {
    this.usersService = service;
  }

  public setPendingImageDispatcher(dispatcher: PendingImageActionDispatcher): void {
    this.pendingImageDispatcher = dispatcher;
  }

  public setImageBatchHandler(handler: ImageBatchHandler): void {
    this.imageBatchHandler = handler;
  }

  public setOcrService(service: OcrService): void {
    this.ocrService = service;
  }

  public setMediaStorageService(service: MediaStorageService): void {
    this.mediaStorageService = service;
  }

  public onModuleDestroy(): void {
    this.imageBatchHandler?.onModuleDestroy();
  }

  public async isMediaSynced(threadId: string, msgId: string): Promise<boolean> {
    if (!msgId) return false;
    if (this.redisService?.isReady) {
      return this.redisService.sismember(`zca:synced_media:${threadId}`, msgId);
    }
    return false;
  }

  public async markMediaSynced(threadId: string, msgId: string): Promise<void> {
    if (!msgId) return;
    if (this.redisService?.isReady) {
      await this.redisService.sadd(`zca:synced_media:${threadId}`, msgId);
    }
  }

  public async bufferRecentMessage(threadId: string, message: Message): Promise<void> {
    if (!threadId || !message?.data) return;
    const msgData = message.data as unknown as Record<string, unknown>;
    const simplified: { data: Record<string, unknown> } = {
      data: {
        msgId: msgData.msgId || msgData.cliMsgId,
        cliMsgId: msgData.cliMsgId,
        msgType: msgData.msgType,
        ts: msgData.ts,
        content: msgData.content,
        uidFrom: msgData.uidFrom,
        dName: msgData.dName,
      },
    };

    let list = this.recentMessageBuffer.get(threadId);
    if (!list) {
      list = [];
      this.recentMessageBuffer.set(threadId, list);
    }
    list.push(simplified);
    if (list.length > 200) {
      list.splice(0, list.length - 200);
    }

    if (this.redisService?.isReady) {
      try {
        const key = `zca:buffered_msgs:${threadId}`;
        await this.redisService.rpush(key, JSON.stringify(simplified));
        await this.redisService.ltrim(key, -200, -1);
        await this.redisService.expire(key, 7 * 24 * 3600);
      } catch (err) {
        this.logger.debug(
          `Could not buffer message in Redis for thread ${threadId}: ${String(err)}`,
        );
      }
    }
  }

  public async getBufferedMessages(
    threadId: string,
  ): Promise<Array<{ data?: Record<string, unknown> }>> {
    if (this.redisService?.isReady) {
      try {
        const rawList = await this.redisService.lrange(`zca:buffered_msgs:${threadId}`, 0, -1);
        if (rawList && rawList.length > 0) {
          return rawList.map((str) => JSON.parse(str) as { data?: Record<string, unknown> });
        }
      } catch (err) {
        this.logger.debug(`Could not read buffered messages from Redis: ${String(err)}`);
      }
    }
    return this.recentMessageBuffer.get(threadId) || [];
  }

  private isSelfListenEnabled(): boolean {
    return (
      this.configService?.get<boolean>('zca.selfListen') === true ||
      process.env.ZCA_SELF_LISTEN?.toLowerCase() === 'true'
    );
  }

  public async onModuleInit(): Promise<void> {
    if (this.moduleRef) {
      if (!this.confirmationService) {
        try {
          const { TransactionConfirmationService } =
            await import('./confirmation/transaction-confirmation.service');
          this.confirmationService = this.moduleRef.get(TransactionConfirmationService, {
            strict: false,
          });
        } catch (err) {
          this.logger.debug(
            `Could not resolve TransactionConfirmationService via ModuleRef: ${String(err)}`,
          );
        }
      }
      if (!this.textInputService) {
        try {
          const { TextInputService } = await import('../zalo/text/text-input.service');
          this.textInputService = this.moduleRef.get(TextInputService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve TextInputService via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.zcaService) {
        try {
          const { ZcaService } = await import('./zca.service');
          this.zcaService = this.moduleRef.get(ZcaService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve ZcaService via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.configService) {
        try {
          const { ConfigService } = await import('@nestjs/config');
          this.configService = this.moduleRef.get(ConfigService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve ConfigService via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.redisService) {
        try {
          const { RedisService } = await import('../redis/redis.service');
          this.redisService = this.moduleRef.get(RedisService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve RedisService via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.adminBootstrapGuard) {
        try {
          const { InitialAdminBootstrapGuard } = await import('./guards/initial-admin-bootstrap.guard');
          this.adminBootstrapGuard = this.moduleRef.get(InitialAdminBootstrapGuard, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve InitialAdminBootstrapGuard via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.grantAccessGuard) {
        try {
          const { GrantAccessGuard } = await import('./guards/grant-access.guard');
          this.grantAccessGuard = this.moduleRef.get(GrantAccessGuard, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve GrantAccessGuard via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.usersService) {
        try {
          const { UsersService } = await import('../users/users.service');
          this.usersService = this.moduleRef.get(UsersService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve UsersService via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.pendingImageDispatcher) {
        try {
          const { PendingImageActionDispatcher } = await import('./pending-image/pending-image-dispatcher.service');
          this.pendingImageDispatcher = this.moduleRef.get(PendingImageActionDispatcher, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve PendingImageActionDispatcher via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.imageBatchHandler) {
        try {
          const { ImageBatchHandler } = await import('./pending-image/image-batch-handler.service');
          this.imageBatchHandler = this.moduleRef.get(ImageBatchHandler, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve ImageBatchHandler via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.ocrService) {
        try {
          const { OcrService } = await import('../ocr/ocr.service');
          this.ocrService = this.moduleRef.get(OcrService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve OcrService via ModuleRef: ${String(err)}`);
        }
      }
      if (!this.mediaStorageService) {
        try {
          const { MediaStorageService } = await import('../receipt-storage/media-storage.service');
          this.mediaStorageService = this.moduleRef.get(MediaStorageService, { strict: false });
        } catch (err) {
          this.logger.debug(`Could not resolve MediaStorageService via ModuleRef: ${String(err)}`);
        }
      }
    }
  }

  private async checkDirectGuardsAndCooldown(
    senderId: string,
    displayName: string,
    chatId: string,
    text: string,
    threadType: number,
    api: API,
  ): Promise<boolean> {
    const input: AgentInput = {
      type: 'text',
      senderId,
      chatId,
      displayName,
      text,
      isBot: false,
    };

    if (this.adminBootstrapGuard && typeof this.adminBootstrapGuard.canActivate === 'function') {
      const isFirstAdminHandled = await this.adminBootstrapGuard.canActivate(input);
      if (isFirstAdminHandled) {
        return false;
      }
    }

    if (this.grantAccessGuard && typeof this.grantAccessGuard.canActivate === 'function') {
      const canAccess = await this.grantAccessGuard.canActivate(input);
      if (!canAccess) {
        return false;
      }
    }

    if (this.usersService && typeof this.usersService.checkCooldown === 'function') {
      const cooldown = this.usersService.checkCooldown(senderId);
      if (!cooldown.allowed) {
        const msg = cooldown.reason || 'Vui lòng gửi chậm lại.';
        await api.sendMessage(msg, chatId, threadType);
        return false;
      }
    }

    return true;
  }

  public async onMessage(message: Message, api: API): Promise<void> {
    const threadId = message.threadId;
    const config: ThreadBotConfig = await this.threadConfigService.getConfig(threadId);

    if (!config.isListened) {
      this.logger.debug(`[ZcaBotFeature] Ignored message from unlistened thread: ${threadId}`);
      return;
    }

    void this.bufferRecentMessage(threadId, message);

    const directConfig: ThreadDirectInteractionConfig = config.directInteraction ?? {
      enabled: true,
      requireMention: true,
      triggerPrefix: '',
      allowAiChat: true,
      allowSelf: false,
    };

    if (message.isSelf) {
      if (!directConfig.allowSelf && !this.isSelfListenEnabled()) {
        this.logger.debug(
          `[ZcaBotFeature] Ignored self message (allowSelf is disabled) in thread ${threadId}`,
        );
        return;
      }
      if (this.zcaService?.isBotSentMessage(message)) {
        this.logger.debug(
          `[ZcaBotFeature] Ignored message originated by bot backend itself in thread ${threadId}`,
        );
        return;
      }
    }

    const senderId = message.data?.uidFrom || '';
    const displayName = message.data?.dName || '';
    const text = getCaptionOrText(message);
    const msgType = message.data?.msgType || '';

    // 1. Fast-path: Check if user is confirming or canceling a pending action via text command ("yes 123", "cancel 123", "edit 123 ...")
    if (text && this.confirmationService) {
      const handled = await this.confirmationService.handleCommand(
        senderId,
        threadId,
        text,
        this.textInputService
          ? async (pending, instruction) => {
              const agentInput: AgentInput = {
                type: 'text',
                senderId,
                chatId: threadId,
                displayName,
                text,
                isBot: false,
              };
              await this.textInputService.handleEditPendingAction(agentInput, pending, instruction);
            }
          : undefined,
      );
      if (handled) {
        this.logger.log(
          `[ZcaBotFeature] Handled pending confirmation text command: "${text}" in thread ${threadId}`,
        );
        return;
      }
    }

    // 2. Fast-path: Check if user is responding to a pending image prompt ("1", "1 ghi chú", "2", "hủy")
    if (text && this.pendingImageDispatcher) {
      const agentInput: AgentInput = {
        type: 'text',
        senderId,
        chatId: threadId,
        displayName,
        text,
        isBot: false,
      };
      const handledImage = await this.pendingImageDispatcher.dispatch(
        agentInput,
        senderId,
        threadId,
        displayName,
        text,
      );
      if (handledImage) {
        this.logger.log(
          `[ZcaBotFeature] Handled pending image action: "${text}" in thread ${threadId}`,
        );
        return;
      }
    }

    // 3. Feature: Auto Media Backup to Google Drive
    const isImage = msgType === 'chat.photo';
    const isVideo = msgType === 'chat.video.msg';
    const isFile = msgType === 'sharefile';
    const isAudio = msgType === 'chat.voice';

    const shouldBackup =
      config.mediaBackup.enabled &&
      ((isImage && config.mediaBackup.uploadImages) ||
        (isVideo && config.mediaBackup.uploadVideos) ||
        (isFile && config.mediaBackup.uploadFiles) ||
        (isAudio && config.mediaBackup.uploadAudios));

    if (shouldBackup) {
      const msgId = message.data?.msgId || message.data?.cliMsgId;
      if (msgId && (await this.isMediaSynced(threadId, msgId))) {
        this.logger.debug(
          `[ZcaBotFeature] Media với msgId "${msgId}" đã được sao lưu trước đó, bỏ qua backup để tránh trùng lặp.`,
        );
      } else {
        const { url: mediaUrl, filename: originalFilename } = extractMediaMeta(message.data?.content);
        if (mediaUrl && this.mediaStorageService) {
          try {
            const mediaLabel = isImage
              ? 'ảnh'
              : isVideo
                ? 'video'
                : isFile
                  ? 'tài liệu/tệp tin'
                  : 'tin nhắn thoại/âm thanh';

            this.logger.log(
              `[ZcaBotFeature] Auto uploading ${mediaLabel} to Google Drive with suffix "${config.mediaBackup.fileSuffix || ''}" and folder "${config.mediaBackup.customFolder || ''}"...`,
            );
            const photosAlbumTitle =
              config.mediaBackup.photosAlbum ||
              config.photosAlbumTitle ||
              (config.threadName ? `[Zalo] ${config.threadName}` : `[Zalo] Nhóm ${threadId}`);

            const buffer = await fetchImageBuffer(mediaUrl);
            const uploadOptions = {
              folderPath: config.mediaBackup.customFolder || undefined,
              suffix: config.mediaBackup.fileSuffix || undefined,
              channelId: threadId,
              msgId: msgId || undefined,
              filename: originalFilename,
              photosAlbumTitle,
              photosAlbumId: config.photosAlbumId || undefined,
              note: `Tự động sao lưu từ ${displayName || senderId} trong nhóm ${config.threadName || threadId}`,
            };

            let dualResult;
            if (isImage) {
              dualResult = await this.mediaStorageService.uploadImage(
                senderId,
                buffer,
                uploadOptions,
              );
            } else if (isVideo) {
              dualResult = await this.mediaStorageService.uploadVideo(
                senderId,
                buffer,
                uploadOptions,
              );
            } else {
              dualResult = await this.mediaStorageService.uploadFile(senderId, buffer, uploadOptions);
            }

            if (dualResult.drive?.fileId && msgId) {
              await this.markMediaSynced(threadId, msgId);
            }

            if (dualResult.drive?.folderId || dualResult.drive?.folderPath) {
              const folderUrl = dualResult.drive.folderId
                ? `https://drive.google.com/drive/folders/${dualResult.drive.folderId}`
                : dualResult.drive.webViewLink;
              if (folderUrl) {
                void this.threadConfigService.saveDriveFolderInfo(threadId, {
                  folderId: dualResult.drive.folderId,
                  folderUrl,
                  folderPath: dualResult.drive.folderPath || config.mediaBackup.customFolder,
                });
              }
            }

            if (dualResult.photos?.albumId || dualResult.photos?.albumUrl) {
              void this.threadConfigService.savePhotosAlbumInfo(threadId, {
                albumId: dualResult.photos.albumId,
                albumUrl: dualResult.photos.albumUrl,
                albumTitle: dualResult.photos.albumTitle || photosAlbumTitle,
              });
            }

            // Chỉ gửi thông báo vào nhóm nếu notifyInThread được bật (mặc định tắt)
            if (config.mediaBackup.notifyInThread) {
              const links: string[] = [];
              if (dualResult.drive?.webViewLink) {
                links.push(`📁 Google Drive: ${dualResult.drive.webViewLink}`);
              }
              if (dualResult.photos?.albumUrl) {
                links.push(`📸 Google Photos: ${dualResult.photos.albumUrl}`);
              }
              if (links.length > 0) {
                const summary = `📁 Đã tự động lưu trữ ${mediaLabel}!\n${links.join('\n')}`;
                await api.sendMessage(summary, threadId, message.type);
              }
            }
          } catch (err) {
            this.logger.error(
              `[ZcaBotFeature] Error auto-uploading media: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    // 4. Resolve Direct Trigger vs Passive Tracking
    const ownId = (api as unknown as { getOwnId?: () => string })?.getOwnId?.() || '';
    const botName =
      this.configService?.get<string>('zalo.botName') ||
      process.env.BOT_NAME ||
      process.env.ZALO_BOT_NAME ||
      'Bot';
    const cleanBotName = (botName || 'Bot').replace(/^@/, '').trim();
    const botNames = [cleanBotName, 'Bot Finance Assistant', 'Finance Assistant', 'Bot', 'bot'];
    const botNamePattern = Array.from(new Set(botNames.filter(Boolean)))
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const botNameRegex = new RegExp(`@(?:bot|zalo|finance|trợ lý|${botNamePattern})`, 'i');
    const hasMention = (ownId && isMentioned(message, ownId)) || botNameRegex.test(text);
    const hasPrefix = Boolean(
      directConfig.triggerPrefix && text.trim().startsWith(directConfig.triggerPrefix),
    );

    const isGroup = message.type === ThreadType.Group;
    const requireMention =
      directConfig.requireMention !== undefined ? directConfig.requireMention : true;
    let isDirectTriggered = false;
    if (directConfig.enabled) {
      if (!requireMention) {
        isDirectTriggered = true;
      } else {
        isDirectTriggered = Boolean(hasMention || hasPrefix);
      }
    } else if (hasMention || (directConfig.triggerPrefix && hasPrefix)) {
      isDirectTriggered = true;
    }

    // In 1-1 chat, sending an image without caption is direct interaction
    if (!isGroup && isImage && !text.trim()) {
      isDirectTriggered = true;
    }

    // Single number "1" or "2" fast-path hint when no image is pending
    if (text && /^[12]$/.test(text.trim()) && isDirectTriggered) {
      await api.sendMessage(
        '💡 Hiện không có hình ảnh hoặc giao dịch nào đang chờ xử lý. Bạn có thể gửi ảnh mới hoặc nhập yêu cầu cụ thể (Ví dụ: "ăn trưa 45k", "mai 9h họp").',
        threadId,
        message.type,
      );
      return;
    }

    // 5. Quoted Image Handling (Quote-replying to an image with @bot instruction)
    const quoteData = (message.data as Record<string, unknown> | undefined)?.quote as
      | Record<string, unknown>
      | undefined;
    const quotedMediaUrl =
      extractMediaMeta(quoteData?.attach).url ||
      extractMediaMeta(quoteData?.msg).url ||
      (typeof quoteData?.attach === 'string' &&
      (quoteData.attach.startsWith('http://') || quoteData.attach.startsWith('https://'))
        ? quoteData.attach
        : null);

    if (quotedMediaUrl && isDirectTriggered) {
      const allowed = await this.checkDirectGuardsAndCooldown(
        senderId,
        displayName,
        threadId,
        text,
        message.type,
        api,
      );
      if (!allowed) return;

      const cleanedText = cleanBotMention(text, botName, directConfig.triggerPrefix);
      let activeReceiptUrl = quotedMediaUrl;
      let ocrText = '';

      try {
        const buffer = await fetchImageBuffer(quotedMediaUrl);
        if (this.ocrService) {
          ocrText = await this.ocrService.extractTextFromBuffer(buffer);
        }
        if (this.mediaStorageService) {
          try {
            const uploadRes = await this.mediaStorageService.uploadBill(senderId, buffer, {
              note: cleanedText,
              channelId: threadId,
            });
            if (uploadRes.drive?.webViewLink) {
              activeReceiptUrl = uploadRes.drive.webViewLink;
            }
          } catch (upErr) {
            this.logger.warn(`[ZcaBotFeature] Failed to upload quoted bill: ${String(upErr)}`);
          }
        }
      } catch (err) {
        this.logger.warn(`[ZcaBotFeature] Failed to fetch/OCR quoted image: ${String(err)}`);
      }

      const promptText = ocrText
        ? `[Nội dung bóc tách từ ảnh hóa đơn qua OCR:\n${ocrText}]\nLời dặn người dùng: ${cleanedText || 'Ghi nhận hóa đơn này'}`
        : cleanedText || 'Ghi nhận hóa đơn này';

      if (this.textInputService) {
        await this.textInputService.process({
          type: 'image',
          senderId,
          chatId: threadId,
          displayName,
          text: promptText,
          imageUrl: activeReceiptUrl,
          isBot: false,
          passiveOnly: false,
          allowAiChat: directConfig.allowAiChat ?? true,
          triggerPrefix: directConfig.triggerPrefix || undefined,
        });
      }
      return;
    }

    // 6. Direct Image Message Processing
    if (isImage) {
      const { url: mediaUrl } = extractMediaMeta(message.data?.content);

      // In 1-1 chat without caption: trigger ImageBatchHandler (interactive menu)
      if (!isGroup && !text.trim()) {
        const allowed = await this.checkDirectGuardsAndCooldown(
          senderId,
          displayName,
          threadId,
          text,
          message.type,
          api,
        );
        if (!allowed) return;

        if (this.imageBatchHandler && mediaUrl) {
          const agentInput: AgentInput = {
            type: 'image',
            senderId,
            chatId: threadId,
            displayName,
            imageUrl: mediaUrl,
            isBot: false,
          };
          await this.imageBatchHandler.handle(agentInput, threadId);
        }
        return;
      }

      // If image has caption and is direct-triggered (e.g. tagged @bot in group or captioned in 1-1)
      if (isDirectTriggered && mediaUrl) {
        const allowed = await this.checkDirectGuardsAndCooldown(
          senderId,
          displayName,
          threadId,
          text,
          message.type,
          api,
        );
        if (!allowed) return;

        const cleanedText = cleanBotMention(text, botName, directConfig.triggerPrefix);
        let activeReceiptUrl = mediaUrl;
        let ocrText = '';

        try {
          const buffer = await fetchImageBuffer(mediaUrl);
          if (this.ocrService) {
            ocrText = await this.ocrService.extractTextFromBuffer(buffer);
          }
          if (this.mediaStorageService) {
            try {
              const uploadRes = await this.mediaStorageService.uploadBill(senderId, buffer, {
                note: cleanedText,
                channelId: threadId,
              });
              if (uploadRes.drive?.webViewLink) {
                activeReceiptUrl = uploadRes.drive.webViewLink;
              }
            } catch (upErr) {
              this.logger.warn(`[ZcaBotFeature] Failed to upload bill: ${String(upErr)}`);
            }
          }
        } catch (err) {
          this.logger.warn(`[ZcaBotFeature] Failed to fetch/OCR image: ${String(err)}`);
        }

        const promptText = ocrText
          ? `[Nội dung bóc tách từ ảnh hóa đơn qua OCR:\n${ocrText}]\nLời dặn người dùng: ${cleanedText || 'Ghi nhận hóa đơn này'}`
          : cleanedText || 'Ghi nhận hóa đơn này';

        if (this.textInputService) {
          await this.textInputService.process({
            type: 'image',
            senderId,
            chatId: threadId,
            displayName,
            text: promptText,
            imageUrl: activeReceiptUrl,
            isBot: false,
            passiveOnly: false,
            allowAiChat: directConfig.allowAiChat ?? true,
            triggerPrefix: directConfig.triggerPrefix || undefined,
          });
        }
        return;
      }

      // Casual image in group without @bot: already backed up (if enabled), do nothing else
      return;
    }

    // 7. Direct Video Processing
    if (isVideo && isDirectTriggered) {
      const allowed = await this.checkDirectGuardsAndCooldown(
        senderId,
        displayName,
        threadId,
        text,
        message.type,
        api,
      );
      if (!allowed) return;

      const { url: videoUrl } = extractMediaMeta(message.data?.content);
      if (videoUrl && this.mediaStorageService) {
        try {
          await api.sendMessage(
            '⏳ Đang tải video lên Google Drive & Google Photos dùng chung...',
            threadId,
            message.type,
          );
          const buffer = await fetchImageBuffer(videoUrl);
          const dualResult = await this.mediaStorageService.uploadVideo(senderId, buffer, {
            note: text || '',
            channelId: threadId,
          });
          const summary = this.mediaStorageService.formatUploadSummary(dualResult, 'video');
          await api.sendMessage(summary, threadId, message.type);
        } catch (err) {
          this.logger.error(`[ZcaBotFeature] Failed to upload direct video: ${String(err)}`);
          await api.sendMessage(
            `⚠️ Không thể lưu trữ video lên Google: ${err instanceof Error ? err.message : String(err)}`,
            threadId,
            message.type,
          );
        }
      }
      return;
    }

    // 8. Text Message Processing
    if (text && this.textInputService) {
      // Check if all text features are disabled
      if (
        !directConfig.enabled &&
        !isDirectTriggered &&
        !config.expenseTracking.enabled &&
        !config.calendarExtraction.enabled
      ) {
        return;
      }

      // If not direct-triggered, only proceed if passive tracking is enabled
      if (
        !isDirectTriggered &&
        !config.expenseTracking.enabled &&
        !config.calendarExtraction.enabled
      ) {
        return;
      }

      if (isDirectTriggered) {
        const allowed = await this.checkDirectGuardsAndCooldown(
          senderId,
          displayName,
          threadId,
          text,
          message.type,
          api,
        );
        if (!allowed) return;
      }

      const agentInput: AgentInput = {
        type: 'text',
        senderId,
        chatId: threadId,
        displayName,
        text,
        isBot: false,
        passiveOnly: !isDirectTriggered,
        allowAiChat: directConfig.allowAiChat ?? true,
        triggerPrefix: directConfig.triggerPrefix || undefined,
      };

      try {
        await this.textInputService.process(agentInput);
      } catch (err) {
        this.logger.error(
          `[ZcaBotFeature] Error processing text in thread ${threadId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  public async onReaction(reaction: Reaction, api: API): Promise<void> {
    const threadId = reaction.threadId;
    const config: ThreadBotConfig = await this.threadConfigService.getConfig(threadId);

    if (!config.isListened || !config.confirmationRules.allowReactions) {
      return;
    }

    if (reaction.isSelf && !config.directInteraction?.allowSelf && !this.isSelfListenEnabled()) {
      return;
    }

    if (!this.confirmationService) {
      return;
    }

    const icon = reaction.data?.content?.rIcon || '';
    const rMsg = reaction.data?.content?.rMsg;
    const targetMsgId = rMsg?.[0]?.gMsgID || rMsg?.[0]?.cMsgID || reaction.data?.msgId;
    const targetCliMsgId = rMsg?.[0]?.cMsgID;
    const senderId = reaction.data?.uidFrom || '';
    const isGroup = reaction.isGroup;
    const threadType = isGroup ? ThreadType.Group : ThreadType.User;

    this.logger.log(
      `[ZcaBotFeature] Reaction received in thread ${threadId}: icon="${icon}", sender="${senderId}", targetMsgId="${targetMsgId || ''}", targetCliMsgId="${targetCliMsgId || ''}"`,
    );

    const result = await this.confirmationService.handleReaction({
      chatId: threadId,
      userId: senderId,
      reactionIcon: icon,
      msgId: targetMsgId ? String(targetMsgId) : undefined,
      cliMsgId: targetCliMsgId ? String(targetCliMsgId) : undefined,
    });

    if (result.handled) {
      if (result.status === 'confirmed') {
        // Confirmation message with heart celebration and full DTO details is already sent by confirmationService.processConfirm!
      } else if (result.status === 'cancelled') {
        // Cancellation message is already sent by confirmationService.processCancel!
      } else if (result.status === 'heart_added') {
        const msg = `❤️ Đã nhận ${result.currentHearts}/${result.requiredHearts} lượt thả tim cho yêu cầu [${result.code}].`;
        await api.sendMessage(msg, threadId, threadType);
      }
    }
  }

  /**
   * Quét lịch sử trò chuyện và sao lưu media (ảnh, video, file) lên Google Drive với cơ chế chống trùng lặp.
   */
  public async syncThreadMediaHistory(
    threadId: string,
    options?: SyncThreadMediaDto,
  ): Promise<SyncThreadMediaResponse> {
    const config = await this.threadConfigService.getConfig(threadId);

    if (!this.zcaService) {
      throw new BadRequestException('Dịch vụ ZCA chưa sẵn sàng.');
    }
    if (!this.zcaService.isLoggedIn()) {
      throw new UnauthorizedException(
        'Tài khoản Zalo cá nhân (ZCA) chưa đăng nhập. Vui lòng đăng nhập qua mã QR trước.',
      );
    }

    if (config.threadType && config.threadType !== 'group') {
      return {
        threadId,
        scannedCount: 0,
        foundCount: 0,
        syncedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        message:
          'Tính năng quét lịch sử hiện chỉ hỗ trợ các Nhóm chat (Group), chưa hỗ trợ tin nhắn cá nhân (1-1).',
      };
    }

    // Resolve time range cutoff and count limit
    let cutoffTime = 0;
    let defaultCount = 100;

    if (options?.sinceTimestamp && options.sinceTimestamp > 0) {
      cutoffTime = options.sinceTimestamp;
    } else if (options?.timeRange) {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      switch (options.timeRange) {
        case '1_month':
          cutoffTime = now - 30 * ONE_DAY;
          defaultCount = 200;
          break;
        case '2_months':
          cutoffTime = now - 60 * ONE_DAY;
          defaultCount = 300;
          break;
        case '3_months':
          cutoffTime = now - 90 * ONE_DAY;
          defaultCount = 500;
          break;
        case '6_months':
          cutoffTime = now - 180 * ONE_DAY;
          defaultCount = 500;
          break;
        case 'all':
          cutoffTime = 0;
          defaultCount = 500;
          break;
      }
    }

    const requestedLimit = Math.min(Math.max(options?.limit ?? defaultCount, 1), 500);
    const mediaTypes = options?.mediaTypes || ['image', 'video', 'file', 'audio'];
    const allowImage = mediaTypes.includes('image');
    const allowVideo = mediaTypes.includes('video');
    const allowFile = mediaTypes.includes('file');
    const allowAudio = mediaTypes.includes('audio');

    this.logger.log(
      `[ZcaBotFeature] Bắt đầu quét lịch sử cho thread ${threadId} (limit: ${requestedLimit}, timeRange: ${options?.timeRange || 'custom'}, types: ${mediaTypes.join(',')})...`,
    );

    let msgs: Array<{ data?: Record<string, unknown> }> = [];
    let isFromBuffer = false;

    try {
      const historyRes = await this.zcaService.getGroupChatHistory(threadId, requestedLimit);
      msgs = historyRes?.groupMsgs || [];
    } catch (err) {
      this.logger.warn(
        `[ZcaBotFeature] Zalo API lấy lịch sử nhóm không khả dụng (${formatErrorMessage(err)}). Thử quét bộ nhớ đệm tin nhắn...`,
      );
      const bufferedMsgs = await this.getBufferedMessages(threadId);
      if (bufferedMsgs && bufferedMsgs.length > 0) {
        msgs = bufferedMsgs;
        isFromBuffer = true;
      } else {
        return {
          threadId,
          scannedCount: 0,
          foundCount: 0,
          syncedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          warning: 'zalo_history_api_unavailable',
          message:
            'Máy chủ Zalo Web hiện đã ngưng hỗ trợ API đọc lại lịch sử cũ của nhóm (mã lỗi 404). Tính năng sao lưu media tự động theo thời gian thực (Real-time) vẫn hoạt động: Mọi hình ảnh, video và tệp tin mới gửi vào nhóm sẽ tự động được tải lên Google Drive ngay lập tức.',
        };
      }
    }

    const scannedCount = msgs.length;
    let foundCount = 0;
    let syncedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const msg of msgs) {
      const msgData = msg?.data || {};
      const msgTime = Number(msgData.ts);
      if (cutoffTime > 0 && msgTime && msgTime < cutoffTime) {
        continue;
      }

      const msgType = String(msgData.msgType || '');
      const isImage = msgType === 'chat.photo';
      const isVideo = msgType === 'chat.video.msg';
      const isFile = msgType === 'sharefile';
      const isAudio = msgType === 'chat.voice';

      const isMatchingType =
        (isImage && allowImage) ||
        (isVideo && allowVideo) ||
        (isFile && allowFile) ||
        (isAudio && allowAudio);

      if (!isMatchingType) {
        continue;
      }

      foundCount++;
      const msgId = String(msgData.msgId || msgData.cliMsgId || '');
      if (msgId && (await this.isMediaSynced(threadId, msgId))) {
        skippedCount++;
        continue;
      }

      const { url: mediaUrl, filename: originalFilename } = extractMediaMeta(msgData.content);
      if (!mediaUrl || !this.mediaStorageService) {
        failedCount++;
        continue;
      }

      try {
        const buffer = await fetchImageBuffer(mediaUrl);
        const senderId = String(msgData.uidFrom || 'unknown');
        const displayName = String(msgData.dName || '');
        const photosAlbumTitle =
          config.mediaBackup?.photosAlbum ||
          config.photosAlbumTitle ||
          (config.threadName ? `[Zalo] ${config.threadName}` : `[Zalo] Nhóm ${threadId}`);

        const uploadOptions = {
          folderPath: config.mediaBackup?.customFolder || undefined,
          suffix: config.mediaBackup?.fileSuffix || undefined,
          channelId: threadId,
          msgId: msgId || undefined,
          filename: originalFilename,
          photosAlbumTitle,
          photosAlbumId: config.photosAlbumId || undefined,
          note: `Sao lưu lịch sử từ ${displayName || senderId} trong nhóm ${config.threadName || threadId}`,
        };

        let dualResult;
        if (isImage) {
          dualResult = await this.mediaStorageService.uploadImage(senderId, buffer, uploadOptions);
        } else if (isVideo) {
          dualResult = await this.mediaStorageService.uploadVideo(senderId, buffer, uploadOptions);
        } else {
          dualResult = await this.mediaStorageService.uploadFile(senderId, buffer, uploadOptions);
        }

        if (dualResult.drive?.fileId) {
          syncedCount++;
          if (msgId) {
            await this.markMediaSynced(threadId, msgId);
          }
          if (dualResult.drive?.folderId || dualResult.drive?.folderPath) {
            const folderUrl = dualResult.drive.folderId
              ? `https://drive.google.com/drive/folders/${dualResult.drive.folderId}`
              : dualResult.drive.webViewLink;
            if (folderUrl) {
              void this.threadConfigService.saveDriveFolderInfo(threadId, {
                folderId: dualResult.drive.folderId,
                folderUrl,
                folderPath: dualResult.drive.folderPath || config.mediaBackup?.customFolder,
              });
            }
          }
          if (dualResult.photos?.albumId || dualResult.photos?.albumUrl) {
            void this.threadConfigService.savePhotosAlbumInfo(threadId, {
              albumId: dualResult.photos.albumId,
              albumUrl: dualResult.photos.albumUrl,
              albumTitle: dualResult.photos.albumTitle || photosAlbumTitle,
            });
          }
        } else {
          failedCount++;
        }

        // Delay 300ms between downloads to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err) {
        this.logger.warn(`[ZcaBotFeature] Lỗi upload media ${msgId} từ lịch sử: ${String(err)}`);
        failedCount++;
      }
    }

    const bufferNote = isFromBuffer ? ' (quét từ bộ nhớ đệm tin nhắn đã nhận gần đây của bot)' : '';
    const message = `Đã quét ${scannedCount} tin nhắn${bufferNote}: tìm thấy ${foundCount} tệp, đã tải lên mới ${syncedCount} tệp, bỏ qua ${skippedCount} tệp đã có${failedCount > 0 ? `, thất bại ${failedCount} tệp` : ''}.`;

    return {
      threadId,
      scannedCount,
      foundCount,
      syncedCount,
      skippedCount,
      failedCount,
      message,
      ...(isFromBuffer ? { warning: 'scanned_from_buffer' } : {}),
    };
  }
}
