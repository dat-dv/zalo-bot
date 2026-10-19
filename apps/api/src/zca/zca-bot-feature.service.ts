import { Injectable, Logger, Optional, Inject, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThreadConfigService } from './thread-config.service';
import type { TransactionConfirmationService } from '../zalo/transaction-confirmation.service';
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
import type { AgentInput } from '../zalo/types/agent-input.type';
import type {
  ThreadBotConfig,
  ThreadDirectInteractionConfig,
  SyncThreadMediaDto,
  SyncThreadMediaResponse,
} from '@zalobot/contracts';
import { RedisService } from '../redis/redis.service';

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

@Injectable()
export class ZcaBotFeatureService implements ZcaPlugin, OnModuleInit {
  public readonly name = 'zca-bot-feature-plugin';
  public readonly description =
    'Orchestrates modular features per listened thread (Media backup to Drive, Expense tracking, Calendar creation, Reaction confirmation)';
  private readonly logger = new Logger(ZcaBotFeatureService.name);

  private readonly mediaStorageService?: MediaStorageService;
  private confirmationService?: TransactionConfirmationService;
  private textInputService?: TextInputService;
  private zcaService?: ZcaService;

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
            await import('../zalo/transaction-confirmation.service');
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
    }
  }

  public async onMessage(message: Message, api: API): Promise<void> {
    const threadId = message.threadId;
    const config: ThreadBotConfig = await this.threadConfigService.getConfig(threadId);

    if (!config.isListened) {
      this.logger.debug(`[ZcaBotFeature] Ignored message from unlistened thread: ${threadId}`);
      return;
    }

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
    const text = getMessageText(message);
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

    // 2. Feature: Auto Media Backup to Google Drive
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
          `[ZcaBotFeature] Media với msgId "${msgId}" đã được sao lưu trước đó, bỏ qua để tránh trùng lặp.`,
        );
        return;
      }

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
          const buffer = await fetchImageBuffer(mediaUrl);
          const uploadOptions = {
            folderPath: config.mediaBackup.customFolder || undefined,
            suffix: config.mediaBackup.fileSuffix || undefined,
            channelId: threadId,
            msgId: msgId || undefined,
            filename: originalFilename,
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

          // Chỉ gửi thông báo vào nhóm nếu notifyInThread được bật (mặc định tắt)
          if (config.mediaBackup.notifyInThread && dualResult.drive?.webViewLink) {
            const summary = `📁 Đã tự động lưu trữ ${mediaLabel} lên Google Drive!\n👉 Xem tại: ${dualResult.drive.webViewLink}`;
            await api.sendMessage(summary, threadId, message.type);
          }
        } catch (err) {
          this.logger.error(
            `[ZcaBotFeature] Error auto-uploading media: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // 3. Text Message Processing (Direct Bot Interaction / Finance Transaction / Calendar Event extraction)
    if (text && this.textInputService) {
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

      // Check whether this is a direct interaction call to the bot (in both Group and 1-1 User chat)
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
        // Fallback: If thread is listened and user explicitly tagged @bot or prefix, treat as direct interaction
        isDirectTriggered = true;
      }

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
      throw new Error('Dịch vụ ZCA chưa sẵn sàng.');
    }
    if (!this.zcaService.isLoggedIn()) {
      throw new Error(
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

    const requestedLimit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const mediaTypes = options?.mediaTypes || ['image', 'video', 'file', 'audio'];
    const allowImage = mediaTypes.includes('image');
    const allowVideo = mediaTypes.includes('video');
    const allowFile = mediaTypes.includes('file');
    const allowAudio = mediaTypes.includes('audio');

    this.logger.log(
      `[ZcaBotFeature] Bắt đầu quét lịch sử cho thread ${threadId} (limit: ${requestedLimit}, types: ${mediaTypes.join(',')})...`,
    );

    let historyRes: GetGroupChatHistoryResponse;
    try {
      historyRes = await this.zcaService.getGroupChatHistory(threadId, requestedLimit);
    } catch (err) {
      this.logger.error(`[ZcaBotFeature] Lỗi khi lấy lịch sử nhóm ${threadId}: ${String(err)}`);
      throw new Error(`Không thể lấy lịch sử từ Zalo: ${formatErrorMessage(err)}`);
    }

    const msgs = historyRes?.groupMsgs || [];
    const scannedCount = msgs.length;
    let foundCount = 0;
    let syncedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const msg of msgs) {
      const msgType = msg.data?.msgType || '';
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
      const msgId = msg.data?.msgId || msg.data?.cliMsgId;
      if (msgId && (await this.isMediaSynced(threadId, msgId))) {
        skippedCount++;
        continue;
      }

      const { url: mediaUrl, filename: originalFilename } = extractMediaMeta(msg.data?.content);
      if (!mediaUrl || !this.mediaStorageService) {
        failedCount++;
        continue;
      }

      try {
        const buffer = await fetchImageBuffer(mediaUrl);
        const senderId = msg.data?.uidFrom || 'unknown';
        const displayName = msg.data?.dName || '';
        const uploadOptions = {
          folderPath: config.mediaBackup?.customFolder || undefined,
          suffix: config.mediaBackup?.fileSuffix || undefined,
          channelId: threadId,
          msgId: msgId || undefined,
          filename: originalFilename,
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

    const message = `Đã quét ${scannedCount} tin nhắn: tìm thấy ${foundCount} tệp, đã tải lên mới ${syncedCount} tệp, bỏ qua ${skippedCount} tệp đã có${failedCount > 0 ? `, thất bại ${failedCount} tệp` : ''}.`;

    return {
      threadId,
      scannedCount,
      foundCount,
      syncedCount,
      skippedCount,
      failedCount,
      message,
    };
  }
}
