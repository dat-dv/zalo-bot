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
  getMessageText,
  isMentioned,
} from './shapes';
import { fetchImageBuffer } from '../common/utils/image-fetcher.util';
import type { AgentInput } from '../zalo/types/agent-input.type';
import type { ThreadBotConfig, ThreadDirectInteractionConfig } from '@zalobot/contracts';

export function extractMediaUrl(content: unknown): string | null {
  if (!content) return null;
  if (typeof content === 'string') {
    try {
      const parsed: unknown = JSON.parse(content);
      return extractMediaUrl(parsed);
    } catch {
      if (content.startsWith('http://') || content.startsWith('https://')) {
        return content;
      }
      return null;
    }
  }
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    if (typeof obj.href === 'string') return obj.href;
    if (typeof obj.url === 'string') return obj.url;
    if (typeof obj.hdUrl === 'string') return obj.hdUrl;
    if (typeof obj.thumb === 'string') return obj.thumb;
    if (typeof obj.link === 'string') return obj.link;
  }
  return null;
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
      requireMention: message.type === ThreadType.Group,
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

    if (
      config.mediaBackup.enabled &&
      ((isImage && config.mediaBackup.uploadImages) || (isVideo && config.mediaBackup.uploadVideos))
    ) {
      const mediaUrl = extractMediaUrl(message.data?.content);
      if (mediaUrl && this.mediaStorageService) {
        try {
          this.logger.log(
            `[ZcaBotFeature] Auto uploading ${isImage ? 'image' : 'video'} to Google Drive with suffix "${config.mediaBackup.fileSuffix || ''}" and folder "${config.mediaBackup.customFolder || ''}"...`,
          );
          const buffer = await fetchImageBuffer(mediaUrl);
          const uploadOptions = {
            folderPath: config.mediaBackup.customFolder || undefined,
            suffix: config.mediaBackup.fileSuffix || undefined,
            channelId: threadId,
            note: `Tự động sao lưu từ ${displayName || senderId} trong nhóm ${config.threadName || threadId}`,
          };

          const dualResult = isImage
            ? await this.mediaStorageService.uploadImage(senderId, buffer, uploadOptions)
            : await this.mediaStorageService.uploadVideo(senderId, buffer, uploadOptions);

          if (dualResult.drive?.webViewLink) {
            const summary = `📁 Đã tự động lưu trữ ${isImage ? 'ảnh' : 'video'} lên Google Drive!\n👉 Xem tại: ${dualResult.drive.webViewLink}`;
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
      const isGroup = message.type === ThreadType.Group;
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

      // In group chats: check whether this is a direct interaction call to the bot
      let isDirectTriggered = !isGroup;
      if (isGroup) {
        const requireMention =
          directConfig.requireMention !== undefined ? directConfig.requireMention : true;
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

      // If in group chat and not direct-triggered, only proceed if passive tracking is enabled
      if (
        isGroup &&
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
        passiveOnly: isGroup && !isDirectTriggered,
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
    const senderId = reaction.data?.uidFrom || '';
    const isGroup = reaction.isGroup;
    const threadType = isGroup ? ThreadType.Group : ThreadType.User;

    this.logger.log(
      `[ZcaBotFeature] Reaction received in thread ${threadId}: icon="${icon}", sender="${senderId}", targetMsgId="${targetMsgId || ''}"`,
    );

    const result = await this.confirmationService.handleReaction({
      chatId: threadId,
      userId: senderId,
      reactionIcon: icon,
      msgId: targetMsgId ? String(targetMsgId) : undefined,
    });

    if (result.handled) {
      if (result.status === 'confirmed') {
        const msg = `🎉 Đã nhận đủ ${result.requiredHearts} lượt thả tim (❤️)! Yêu cầu [${result.code}] đã được xác nhận thành công.`;
        await api.sendMessage(msg, threadId, threadType);
      } else if (result.status === 'cancelled') {
        const msg = `❌ Yêu cầu [${result.code}] đã bị hủy bỏ bởi biểu cảm phẫn nộ (😡).`;
        await api.sendMessage(msg, threadId, threadType);
      } else if (result.status === 'heart_added') {
        const msg = `❤️ Đã nhận ${result.currentHearts}/${result.requiredHearts} lượt thả tim cho yêu cầu [${result.code}].`;
        await api.sendMessage(msg, threadId, threadType);
      }
    }
  }
}
