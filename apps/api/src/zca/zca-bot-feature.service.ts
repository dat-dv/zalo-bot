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
import { getThreadStorageTarget, ThreadConfigService } from './thread-config.service';
import type { TransactionConfirmationService } from './confirmation/transaction-confirmation.service';
import { MediaStorageService } from '../receipt-storage/media-storage.service';
import type { TextInputService } from './text/text-input.service';
import type { ZcaService } from './zca.service';
import type { ZcaPlugin } from './zca.interfaces';
import {
  ThreadType,
  type API,
  type Message,
  type Reaction,
  type Undo,
  getMessageText,
  isMentioned,
  isGroupMessage,
} from './shapes';
import { fetchImageBuffer } from '../common/utils/image-fetcher.util';
import type { AgentInput } from '../types/agent-input.type';
import {
  findTriggerPrefix,
  type IReminderTargetUser,
  type ThreadBotConfig,
  type ThreadDirectInteractionConfig,
  type SyncThreadMediaDto,
  type SyncThreadMediaResponse,
} from '@zalobot/contracts';
import { RedisService } from '../redis/redis.service';
import type { InitialAdminBootstrapGuard } from './guards/initial-admin-bootstrap.guard';
import type { GrantAccessGuard } from './guards/grant-access.guard';
import { ThreadAccessService } from './access/thread-access.service';
import type { ThreadAccessKind } from './access/thread-access-policy';
import type { UsersService } from '../users/users.service';
import type { PendingImageActionDispatcher } from './pending-image/pending-image-dispatcher.service';
import type { ImageBatchHandler } from './pending-image/image-batch-handler.service';
import type { OcrService } from '../ocr/ocr.service';
import { cleanBotMention } from './text/bot-mention.util';
import { ChatMemoryService } from './memory/chat-memory.service';
import { ImageTextMemoryService } from './memory/image-text-memory.service';

/** Per-thread memory settings for the text pipeline. */
function toAgentMemory(config: ThreadBotConfig): Pick<AgentInput, 'longTermMemory'> {
  return { longTermMemory: config.chatMemory?.enabled === true };
}

/** A history payload field as text; objects and missing values become ''. */
function readTextField(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

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

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asImageUrl(value: unknown): string | null {
  return typeof value === 'string' && /^(?:https?:\/\/|data:image\/)/i.test(value) ? value : null;
}

/**
 * Resolves the image URL of a quoted message. Real Zalo quotes of photos (`cliMsgType: 32`) carry the
 * full-size URL inside the nested JSON string `attach.params.hd`, not at the top level.
 */
export function extractQuotedImageUrl(quote: unknown): string | null {
  const quoteObj = parseJsonRecord(quote);
  if (!quoteObj) return null;

  const attach = parseJsonRecord(quoteObj.attach);
  if (!attach) return asImageUrl(quoteObj.attach);

  const params = parseJsonRecord(attach.params);
  const candidates: unknown[] = [
    params?.hd,
    params?.rawUrl,
    params?.oriUrl,
    attach.href,
    attach.hdUrl,
    attach.thumb,
    attach.url,
  ];
  for (const candidate of candidates) {
    const url = asImageUrl(candidate);
    if (url) return url;
  }
  return null;
}

/**
 * People tagged in a group message, except the bot and `@All` (uid `-1`), named by the tag
 * text (`@Trí` → `Trí`). Tools use them as the people to remind, so the LLM never has to
 * guess a person from a name.
 */
export function extractTaggedUsers(
  text: string,
  mentions: unknown,
  ownId: string,
): IReminderTargetUser[] {
  if (!Array.isArray(mentions)) return [];
  const users: IReminderTargetUser[] = [];
  for (const raw of mentions) {
    const mention = parseJsonRecord(raw);
    if (!mention) continue;
    const { uid, pos, len } = mention;
    if (typeof uid !== 'string' || !uid || uid === ownId || uid === '-1') continue;
    if (typeof pos !== 'number' || typeof len !== 'number' || pos < 0 || len <= 0) continue;
    if (users.some((user) => user.id === uid)) continue;
    const name = text
      .slice(pos, pos + len)
      .replace(/^@/, '')
      .trim();
    users.push({ id: uid, name: name || uid });
  }
  return users;
}

/**
 * Removes the bot's own mentions so pending commands match even when written as "@Đen edit 125 …".
 * Mention entities (`uid === ownId`, `pos`/`len`) are cut first because the displayed bot name may
 * differ from the configured `botName`; `cleanBotMention` then handles `@bot` aliases and the prefix.
 * Mentions of other members are kept so "yes 123 @Trí" is not silently turned into a command.
 */
export function stripBotMentions(
  text: string,
  mentions: unknown,
  ownId: string,
  botName: string,
  triggerPrefixes: readonly string[] = [],
): string {
  let result = text;
  if (ownId && Array.isArray(mentions)) {
    const ranges = mentions
      .map((m: unknown) => parseJsonRecord(m))
      .filter(
        (m): m is Record<string, unknown> =>
          m !== null &&
          m.uid === ownId &&
          typeof m.pos === 'number' &&
          typeof m.len === 'number' &&
          m.pos >= 0 &&
          m.len > 0,
      )
      .map((m) => ({ pos: m.pos as number, len: m.len as number }))
      .sort((a, b) => b.pos - a.pos);
    for (const { pos, len } of ranges) {
      if (pos + len > result.length) continue;
      result = `${result.slice(0, pos)} ${result.slice(pos + len).replace(/^[,:.-]+/, '')}`;
    }
    result = result
      .replace(/^[\s,:.-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return cleanBotMention(result, botName, triggerPrefixes);
}

const OCR_CONTEXT_MAX_CHARS = 2000;
const DEFAULT_IMAGE_INSTRUCTION = 'Ghi nhận hóa đơn này';

/** Builds a neutral LLM prompt: the image may be a bill, a menu, a poster or a schedule. */
export function buildImageOcrPrompt(ocrText: string, instruction: string): string {
  const request = instruction.trim() || DEFAULT_IMAGE_INSTRUCTION;
  const trimmedOcr = ocrText.trim();
  if (!trimmedOcr) {
    return `[Ảnh đính kèm không đọc được chữ qua OCR]\nYêu cầu của người dùng: ${request}`;
  }
  const clipped =
    trimmedOcr.length > OCR_CONTEXT_MAX_CHARS
      ? `${trimmedOcr.slice(0, OCR_CONTEXT_MAX_CHARS)}…`
      : trimmedOcr;
  return `[Văn bản trích từ ảnh đính kèm (OCR, có thể sai chính tả):\n${clipped}]\nYêu cầu của người dùng: ${request}`;
}

export function getCaptionOrText(message: Message): string {
  const msgType = message.data?.msgType;
  const content = message.data?.content;
  if (msgType === 'chat.photo' || msgType === 'chat.video.msg' || msgType === 'sharefile') {
    if (typeof content === 'string') {
      try {
        const parsed: unknown = JSON.parse(content);
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
      if (typeof obj.description === 'string' && obj.description.trim())
        return obj.description.trim();
      if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
      return '';
    }
  }
  return getMessageText(message);
}

export function isStorageUploadInstruction(text: string): boolean {
  const norm = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Option 2 directly from prompt (e.g. "2", "2 lưu drive", "2 lưu ảnh")
  if (/^2(?:\s+.*)?$/.test(norm)) {
    return true;
  }

  // If instruction explicitly refers to bill/expense transaction without mentioning drive/storage
  // e.g. "lưu hóa đơn này", "quét hóa đơn", "tạo bill" -> goes to OCR bill flow
  if (
    /\b(?:hoa\s*don|bill|chi\s*tieu|thu\s*chi|thanh\s*toan)\b/i.test(norm) &&
    !/\b(?:drive|kho)\b/i.test(norm)
  ) {
    return false;
  }

  // Action verbs for saving/uploading
  const hasSaveAction = /\b(?:luu|upload|up|save|backup|luu\s*tru)\b/i.test(norm);
  // Storage destinations or media types
  const hasStorageTargetOrMedia =
    /\b(?:drive|google\s*drive|kho|photos?|anh|hinh|video|file|clip|tep)\b/i.test(norm);

  return hasSaveAction && hasStorageTargetOrMedia;
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
  private readonly threadAccessService: ThreadAccessService;
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
    @Optional() private readonly chatMemoryService?: ChatMemoryService,
    @Optional() threadAccessService?: ThreadAccessService,
    @Optional() private readonly imageTextMemoryService?: ImageTextMemoryService,
  ) {
    this.threadAccessService = threadAccessService ?? new ThreadAccessService();
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
          const { TextInputService } = await import('./text/text-input.service');
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
          const { InitialAdminBootstrapGuard } =
            await import('./guards/initial-admin-bootstrap.guard');
          this.adminBootstrapGuard = this.moduleRef.get(InitialAdminBootstrapGuard, {
            strict: false,
          });
        } catch (err) {
          this.logger.debug(
            `Could not resolve InitialAdminBootstrapGuard via ModuleRef: ${String(err)}`,
          );
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
          const { PendingImageActionDispatcher } =
            await import('./pending-image/pending-image-dispatcher.service');
          this.pendingImageDispatcher = this.moduleRef.get(PendingImageActionDispatcher, {
            strict: false,
          });
        } catch (err) {
          this.logger.debug(
            `Could not resolve PendingImageActionDispatcher via ModuleRef: ${String(err)}`,
          );
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

  private async checkDirectGuardsAndCooldown(params: {
    senderId: string;
    displayName: string;
    chatId: string;
    text: string;
    threadType: number;
    api: API;
    isSelf?: boolean;
    config: ThreadBotConfig;
    accessKind: ThreadAccessKind;
  }): Promise<boolean> {
    const { senderId, displayName, chatId, text, threadType, api, isSelf, config, accessKind } =
      params;
    const ownId = (api as unknown as { getOwnId?: () => string })?.getOwnId?.() || '';
    const isOwner = Boolean(isSelf || (ownId && ownId === senderId));

    // If sender is the bot account itself (e.g. self-listen testing), bypass access guards
    if (isOwner) {
      return true;
    }

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
      const threadGrant = this.threadAccessService.grantsThreadAccess(senderId, config, accessKind);
      const canAccess = await this.grantAccessGuard.canActivate(input, { threadGrant });
      if (!canAccess) {
        return false;
      }
    }

    if (this.usersService && typeof this.usersService.checkCooldown === 'function') {
      const cooldown = this.usersService.checkCooldown(senderId);
      if (!cooldown.allowed) {
        const msg = cooldown.reason || 'Bạn nhắn nhanh quá, chờ chút rồi gửi tiếp.';
        await api.sendMessage(msg, chatId, threadType);
        return false;
      }
    }

    return true;
  }

  /**
   * Fetches an image, always runs OCR on it and builds the LLM prompt with the extracted text as
   * context. The image is also archived as a bill so the receipt link survives Zalo CDN expiry.
   */
  private async prepareImageOcrContext(params: {
    mediaUrl: string;
    senderId: string;
    threadId: string;
    cleanedText: string;
    source: 'quoted' | 'direct';
    /** The photo's own message id, when it is the message being answered. */
    messageId?: string;
  }): Promise<{ promptText: string; receiptUrl: string }> {
    const { mediaUrl, senderId, threadId, cleanedText, source, messageId } = params;
    let receiptUrl = mediaUrl;
    let ocrText = '';

    try {
      const buffer = await fetchImageBuffer(mediaUrl);
      // A photo the chat memory is reading is read once, for both the memory and this reply.
      const readForMemory =
        source === 'direct'
          ? await this.imageTextMemoryService?.recognizeNow(threadId, messageId, buffer)
          : null;
      if (typeof readForMemory === 'string') {
        ocrText = readForMemory;
      } else if (this.ocrService) {
        ocrText = await this.ocrService.extractTextFromBuffer(buffer);
      } else {
        this.logger.warn(
          `[ZcaBotFeature] OcrService unavailable; ${source} image sent without OCR context.`,
        );
      }
      if (this.mediaStorageService) {
        try {
          const uploadRes = await this.mediaStorageService.uploadBill(
            senderId,
            buffer,
            await this.threadConfigService.getStorageTarget(threadId),
            { note: cleanedText },
          );
          if (uploadRes.drive?.webViewLink) {
            receiptUrl = uploadRes.drive.webViewLink;
          }
        } catch (upErr) {
          this.logger.warn(
            `[ZcaBotFeature] Failed to upload ${source} image: ${formatErrorMessage(upErr)}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `[ZcaBotFeature] Failed to fetch/OCR ${source} image: ${formatErrorMessage(err)}`,
      );
    }

    this.logger.log(
      `[ZcaBotFeature] ${source === 'quoted' ? 'Quoted' : 'Direct'} image in thread ${threadId} -> OCR ${ocrText.length} chars`,
    );
    if (ocrText) {
      this.logger.debug(`[ZcaBotFeature] OCR text (${source}): ${ocrText}`);
    }

    return { promptText: buildImageOcrPrompt(ocrText, cleanedText), receiptUrl };
  }

  private async handleDirectMediaStorageUpload(params: {
    mediaUrl: string;
    senderId: string;
    threadId: string;
    cleanedText: string;
    config: ThreadBotConfig;
    messageType: ThreadType;
    api: API;
    isVideo?: boolean;
  }): Promise<void> {
    const { mediaUrl, senderId, threadId, cleanedText, config, messageType, api, isVideo } = params;

    if (!this.mediaStorageService) {
      await api.sendMessage(
        '☁️ Tính năng lưu ảnh lên Google Drive đang được phát triển.',
        threadId,
        messageType,
      );
      return;
    }

    try {
      await api.sendMessage(
        isVideo
          ? '⏳ Đang tải video lên Google Drive và Photos dùng chung...'
          : '⏳ Đang tải ảnh lên Google Drive và Photos dùng chung...',
        threadId,
        messageType,
      );

      const buffer = await fetchImageBuffer(mediaUrl);
      const target = getThreadStorageTarget(config);
      const photosAlbumTitle = target.photosAlbumTitle;
      const uploadOptions = {
        note: cleanedText || (isVideo ? 'Video lưu theo yêu cầu' : 'Ảnh lưu theo yêu cầu'),
      };

      const dualResult = isVideo
        ? await this.mediaStorageService.uploadVideo(senderId, buffer, target, uploadOptions)
        : await this.mediaStorageService.uploadImage(senderId, buffer, target, uploadOptions);

      if (dualResult.photos?.albumId || dualResult.photos?.albumUrl) {
        void this.threadConfigService.savePhotosAlbumInfo(threadId, {
          albumId: dualResult.photos.albumId,
          albumUrl: dualResult.photos.albumUrl,
          albumTitle: dualResult.photos.albumTitle || photosAlbumTitle,
        });
      }

      const summary = this.mediaStorageService.formatUploadSummary(
        dualResult,
        isVideo ? 'video' : 'image',
      );
      await api.sendMessage(summary, threadId, messageType);
    } catch (err) {
      this.logger.error(`[ZcaBotFeature] Failed to upload media to Drive: ${String(err)}`);
      await api.sendMessage(
        `⚠️ Không lưu được ${isVideo ? 'video' : 'ảnh'} lên Google: ${err instanceof Error ? err.message : String(err)}`,
        threadId,
        messageType,
      );
    }
  }

  /**
   * Queues a photo so the text read from it (local OCR, in the background) joins its entry in the
   * chat memory when it is on. Every photo of the chat, whether or not it addresses the bot.
   */
  private rememberImageText(
    message: Message,
    config: ThreadBotConfig,
    channelType: 'user' | 'group',
    afterStored?: Promise<unknown>,
  ): void {
    const memory = config.chatMemory;
    if (!this.imageTextMemoryService || message.data?.msgType !== 'chat.photo') return;
    if (!memory?.readImageText || !memory.enabled) return;
    const { url } = extractMediaMeta(message.data?.content);
    if (!url) return;
    this.imageTextMemoryService.enqueue({
      channelId: message.threadId,
      channelType,
      data: message.data,
      imageUrl: url,
      afterStored,
    });
  }

  private resolveBotName(): string {
    return this.configService?.get<string>('zalo.botName') || process.env.BOT_NAME || 'Bot';
  }

  /**
   * The text pipeline's input for a message. `text` may be a cleaned copy (bot mention
   * stripped); the people tagged are read from the raw message, whose mention offsets they use.
   */
  private buildTextAgentInput(
    message: Message,
    api: API,
    fields: {
      text: string;
      directConfig: ThreadDirectInteractionConfig;
      memory: Pick<AgentInput, 'longTermMemory'>;
    },
  ): AgentInput {
    const { text, directConfig, memory } = fields;
    return {
      type: 'text',
      senderId: message.data?.uidFrom || '',
      chatId: message.threadId,
      displayName: message.data?.dName || '',
      text,
      isBot: false,
      allowAiChat: directConfig.allowAiChat ?? true,
      triggerPrefixes: directConfig.triggerPrefixes ?? [],
      messageId: message.data?.msgId ? String(message.data.msgId) : undefined,
      taggedUsers: isGroupMessage(message)
        ? extractTaggedUsers(
            getCaptionOrText(message),
            message.data.mentions,
            typeof api?.getOwnId === 'function' ? api.getOwnId() : '',
          )
        : [],
      ...memory,
    };
  }

  private isOwnerSender(message: Message, api: API): boolean {
    const ownId = typeof api?.getOwnId === 'function' ? api.getOwnId() : '';
    const senderId = message.data?.uidFrom || '';
    return Boolean(message.isSelf || (ownId && ownId === senderId));
  }

  /** `edit <code>` is allowed for the pending owner, the bot account, or any granted user. */
  private async canEditPending(
    pending: { userId: string },
    senderId: string,
    isOwner: boolean,
  ): Promise<boolean> {
    if (isOwner || pending.userId === senderId) return true;
    return Boolean(await this.usersService?.isGrantAccess(senderId));
  }

  /**
   * Message flows after the shared gates (self-message rules, listened thread):
   * - Pending fast-paths: `yes/cancel/edit <code>` and pending image replies. `edit` is limited to
   *   the pending owner or granted users and only re-issues the same tool.
   * - L3 passive media: auto backup per `mediaBackup`, for every member (no user access check).
   *   A media message that does not address the bot stops there: stored, never sent to AI. A photo
   *   in a chat with memory on still has its text read locally for that memory (`readImageText`).
   * - L1 direct: in a group the message must @mention the bot or start with one of the thread's
   *   `triggerPrefixes`; in a 1-1 chat any text addresses the bot. Direct guards with replies,
   *   full tool set, AI chat per `allowAiChat`.
   * - Anything else is ignored without an LLM call: the bot only works when someone asks it to.
   */
  public async onMessage(message: Message, api: API): Promise<void> {
    const threadId = message.threadId;
    // ZCA group ids are plain numbers, so the default config must get its type from zca-js.
    const config: ThreadBotConfig = await this.threadConfigService.getConfig(threadId, {
      threadType: message.type === ThreadType.Group ? 'group' : 'user',
    });

    if (!config.isListened) {
      this.logger.debug(`[ZcaBotFeature] Ignored message from unlistened thread: ${threadId}`);
      return;
    }

    void this.bufferRecentMessage(threadId, message);
    const memory = toAgentMemory(config);
    const messageId = message.data?.msgId ? String(message.data.msgId) : undefined;
    const channelType = message.type === ThreadType.Group ? 'group' : 'user';
    // The bot's own messages echoed back by self-listen are stored
    // by the send wrapper with the kind they were sent as, so they are skipped here.
    const isBotEcho = Boolean(message.isSelf && this.zcaService?.isBotSentMessage(message));
    // Never rejects; the photo reader waits for the row before adding the photo's text to it.
    const stored =
      memory.longTermMemory && !isBotEcho
        ? this.chatMemoryService?.record(threadId, channelType, message.data)
        : undefined;
    this.rememberImageText(message, config, channelType, stored);

    const directConfig: ThreadDirectInteractionConfig = config.directInteraction ?? {
      enabled: true,
      triggerPrefixes: [],
      allowAiChat: true,
      allowSelf: false,
    };
    const triggerPrefixes = directConfig.triggerPrefixes ?? [];

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
      const commandText = stripBotMentions(
        text,
        isGroupMessage(message) ? message.data.mentions : undefined,
        typeof api?.getOwnId === 'function' ? api.getOwnId() : '',
        this.resolveBotName(),
        triggerPrefixes,
      );
      const handled = await this.confirmationService.handleCommand(
        senderId,
        threadId,
        commandText,
        this.textInputService
          ? (pending, instruction) =>
              // Same input as the AI path (tags, memory...): an edit that tags people reminds them.
              this.textInputService.handleEditPendingAction(
                this.buildTextAgentInput(message, api, { text: commandText, directConfig, memory }),
                pending,
                instruction,
              )
          : undefined,
        (pending) => this.canEditPending(pending, senderId, this.isOwnerSender(message, api)),
      );
      if (handled) {
        this.logger.log(
          `[ZcaBotFeature] Handled pending confirmation text command: "${text}" in thread ${threadId}`,
        );
        // "yes 302" is a command, not conversation: kept out of the long-term memory.
        if (messageId) {
          void stored?.then(() => this.chatMemoryService?.setKind(threadId, messageId, 'request'));
        }
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
        const { url: mediaUrl, filename: originalFilename } = extractMediaMeta(
          message.data?.content,
        );
        if (mediaUrl && this.mediaStorageService) {
          try {
            const mediaLabel = isImage
              ? 'ảnh'
              : isVideo
                ? 'video'
                : isFile
                  ? 'tệp'
                  : 'tin nhắn thoại';

            this.logger.log(
              `[ZcaBotFeature] Auto uploading ${mediaLabel} to Google Drive with suffix "${config.mediaBackup.fileSuffix || ''}" and folder "${config.mediaBackup.customFolder || ''}"...`,
            );
            const target = getThreadStorageTarget(config);
            const photosAlbumTitle = target.photosAlbumTitle;

            const buffer = await fetchImageBuffer(mediaUrl);
            const uploadOptions = {
              msgId: msgId || undefined,
              filename: originalFilename,
              note: `Tự động sao lưu từ ${displayName || senderId} trong nhóm ${config.threadName || threadId}`,
            };

            let dualResult;
            if (isImage) {
              dualResult = await this.mediaStorageService.uploadImage(
                senderId,
                buffer,
                target,
                uploadOptions,
              );
            } else if (isVideo) {
              dualResult = await this.mediaStorageService.uploadVideo(
                senderId,
                buffer,
                target,
                uploadOptions,
              );
            } else {
              dualResult = await this.mediaStorageService.uploadFile(
                senderId,
                buffer,
                target,
                uploadOptions,
              );
            }

            if (dualResult.drive?.fileId && msgId) {
              await this.markMediaSynced(threadId, msgId);
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
                links.push(`Google Drive: ${dualResult.drive.webViewLink}`);
              }
              if (dualResult.photos?.albumUrl) {
                links.push(`Google Photos: ${dualResult.photos.albumUrl}`);
              }
              if (links.length > 0) {
                const summary = `☁️ Đã tự động lưu ${mediaLabel} lên Google:\n${links.join('\n')}`;
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

    // 4. Resolve whether the message addresses the bot
    const ownId = (api as unknown as { getOwnId?: () => string })?.getOwnId?.() || '';
    const botName = this.resolveBotName();
    const cleanBotName = (botName || 'Bot').replace(/^@/, '').trim();
    const botNames = [cleanBotName, 'Bot Finance Assistant', 'Finance Assistant', 'Bot', 'bot'];
    const botNamePattern = Array.from(new Set(botNames.filter(Boolean)))
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const botNameRegex = new RegExp(`@(?:bot|zalo|finance|trợ lý|${botNamePattern})`, 'i');
    const hasMention = (ownId && isMentioned(message, ownId)) || botNameRegex.test(text);
    const hasPrefix = findTriggerPrefix(text, triggerPrefixes) !== null;

    // Groups always need a mention or prefix; a 1-1 chat with the bot account is already addressed
    // to it. A media message without text never counts: it is only backed up (L3).
    const isGroup = message.type === ThreadType.Group;
    const hasText = text.trim().length > 0;
    const isDirectTriggered = Boolean(hasMention || hasPrefix || (!isGroup && hasText));

    // Everything below answers the sender, so a message that does not address the bot stops here
    // (it was already backed up / remembered above) and access is checked once for the rest.
    if (!isDirectTriggered) return;
    const allowed = await this.checkDirectGuardsAndCooldown({
      senderId,
      displayName,
      chatId: threadId,
      text,
      threadType: message.type,
      api,
      isSelf: Boolean(message.isSelf),
      config,
      accessKind: isGroup ? 'group' : 'user',
    });
    if (!allowed) return;

    // Single number "1" or "2" fast-path hint when no image is pending
    if (text && /^[12]$/.test(text.trim())) {
      await api.sendMessage(
        'Không có ảnh hay giao dịch nào đang chờ. Gửi ảnh mới hoặc nhắn yêu cầu, vd "ăn trưa 45k", "mai 9h họp".',
        threadId,
        message.type,
      );
      return;
    }

    // 5. Quoted Image Handling (Quote-replying to an image with @bot instruction)
    const quoteData = (message.data as Record<string, unknown> | undefined)?.quote as
      Record<string, unknown> | undefined;
    const quotedMediaUrl =
      extractQuotedImageUrl(quoteData) || extractMediaMeta(quoteData?.msg).url || null;
    if (quoteData && !quotedMediaUrl && quoteData.cliMsgType === 32) {
      this.logger.warn(
        `[ZcaBotFeature] Quoted photo in thread ${threadId} has no resolvable image URL; OCR context skipped.`,
      );
    }

    if (quotedMediaUrl) {
      const cleanedText = cleanBotMention(text, botName, triggerPrefixes);

      // 5a. Quoted media storage upload request (e.g. "@bot lưu ảnh này lên drive")
      if (isStorageUploadInstruction(cleanedText)) {
        const isQuotedVideo =
          /\b(?:video|clip|mp4|mov)\b/i.test(cleanedText) ||
          /\b(?:video|clip)\b/i.test(JSON.stringify(quoteData?.attach || ''));
        await this.handleDirectMediaStorageUpload({
          mediaUrl: quotedMediaUrl,
          senderId,
          threadId,
          cleanedText,
          config,
          messageType: message.type,
          api,
          isVideo: isQuotedVideo,
        });
        return;
      }

      // 5b. Default: mandatory OCR of the quoted image as LLM context, then AI tool execution
      const { promptText, receiptUrl: activeReceiptUrl } = await this.prepareImageOcrContext({
        mediaUrl: quotedMediaUrl,
        senderId,
        threadId,
        cleanedText,
        source: 'quoted',
      });

      if (this.textInputService) {
        await this.textInputService.process({
          type: 'image',
          senderId,
          chatId: threadId,
          displayName,
          text: promptText,
          imageUrl: activeReceiptUrl,
          isBot: false,
          allowAiChat: directConfig.allowAiChat ?? true,
          triggerPrefixes,
          ...memory,
          messageId,
        });
      }
      return;
    }

    // 6. Direct Image Message Processing
    if (isImage) {
      const { url: mediaUrl } = extractMediaMeta(message.data?.content);

      // Image with a caption that addresses the bot (tagged @bot in group or captioned in 1-1)
      if (mediaUrl) {
        const cleanedText = cleanBotMention(text, botName, triggerPrefixes);

        // 6a. Direct image captioned with request to save to Drive (e.g. "@bot lưu ảnh này lên drive")
        if (isStorageUploadInstruction(cleanedText)) {
          await this.handleDirectMediaStorageUpload({
            mediaUrl,
            senderId,
            threadId,
            cleanedText,
            config,
            messageType: message.type,
            api,
            isVideo: false,
          });
          return;
        }

        // 6b. Default direct image with caption -> mandatory OCR context -> TextInputService
        const { promptText, receiptUrl: activeReceiptUrl } = await this.prepareImageOcrContext({
          mediaUrl,
          senderId,
          threadId,
          cleanedText,
          source: 'direct',
          messageId,
        });

        if (this.textInputService) {
          await this.textInputService.process({
            type: 'image',
            senderId,
            chatId: threadId,
            displayName,
            text: promptText,
            imageUrl: activeReceiptUrl,
            isBot: false,
            allowAiChat: directConfig.allowAiChat ?? true,
            triggerPrefixes,
            ...memory,
            messageId,
          });
        }
        return;
      }

      // No resolvable image URL: nothing to read
      return;
    }

    // 7. Direct Video Processing
    if (isVideo) {
      const { url: videoUrl } = extractMediaMeta(message.data?.content);
      if (videoUrl && this.mediaStorageService) {
        try {
          await api.sendMessage(
            '⏳ Đang tải video lên Google Drive và Photos dùng chung...',
            threadId,
            message.type,
          );
          const buffer = await fetchImageBuffer(videoUrl);
          const dualResult = await this.mediaStorageService.uploadVideo(
            senderId,
            buffer,
            await this.threadConfigService.getStorageTarget(threadId),
            { note: text || '' },
          );
          const summary = this.mediaStorageService.formatUploadSummary(dualResult, 'video');
          await api.sendMessage(summary, threadId, message.type);
        } catch (err) {
          this.logger.error(`[ZcaBotFeature] Failed to upload direct video: ${String(err)}`);
          await api.sendMessage(
            `⚠️ Không lưu được video lên Google: ${err instanceof Error ? err.message : String(err)}`,
            threadId,
            message.type,
          );
        }
      }
      return;
    }

    // 8. Text Message Processing: only text that addresses the bot reaches the AI.
    if (text && this.textInputService) {
      const agentInput = this.buildTextAgentInput(message, api, { text, directConfig, memory });

      try {
        await this.textInputService.process(agentInput);
      } catch (err) {
        this.logger.error(
          `[ZcaBotFeature] Error processing text in thread ${threadId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * A message recalled in Zalo is also forgotten by the chat memory (and its day is sent to Cognee
   * again without it), even when the thread has since turned it off.
   */
  public async onUndo(undo: Undo): Promise<void> {
    const recalledMsgId = undo.data?.content?.globalMsgId;
    const recalledCliMsgId = undo.data?.content?.cliMsgId;
    const senderUid = undo.data?.uidFrom;
    if (!undo.threadId || !recalledMsgId) return;
    const byClient =
      recalledCliMsgId && senderUid
        ? { cliMsgId: String(recalledCliMsgId), senderUid: String(senderUid) }
        : undefined;
    await this.chatMemoryService?.markRecalled(undo.threadId, String(recalledMsgId), byClient);
  }

  /**
   * Plugin init (after listened threads are loaded): seeds the chat memory of listened threads
   * with memory on from the Redis recent buffer, once per start. Runs in the background so login
   * is never delayed.
   */
  public init(): void {
    const memory = this.chatMemoryService;
    if (!memory) return;
    void (async () => {
      for (const threadId of this.threadConfigService.getListenedThreadIds()) {
        const stored = await this.threadConfigService.findStoredConfig(threadId);
        if (!stored?.chatMemory?.enabled) continue;
        const buffered = await this.getBufferedMessages(threadId);
        const isGroup = await this.threadConfigService.isGroupThread(threadId);
        const count = await memory.backfill(
          threadId,
          isGroup ? 'group' : 'user',
          buffered.map((entry) => entry.data ?? {}),
        );
        if (count > 0) {
          this.logger.log(`[ChatMemory] Backfilled ${count} buffered message(s) of ${threadId}`);
        }
      }
    })().catch((err: unknown) => {
      this.logger.warn(`[ChatMemory] Backfill failed: ${formatErrorMessage(err)}`);
    });
  }

  public async onReaction(reaction: Reaction, _api: API): Promise<void> {
    const threadId = reaction.threadId;
    const isGroup = reaction.isGroup;
    const config: ThreadBotConfig = await this.threadConfigService.getConfig(threadId, {
      threadType: isGroup ? 'group' : 'user',
    });

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

    this.logger.log(
      `[ZcaBotFeature] Reaction received in thread ${threadId}: icon="${icon}", sender="${senderId}", targetMsgId="${targetMsgId || ''}", targetCliMsgId="${targetCliMsgId || ''}"`,
    );

    // The confirmation service sends every outcome itself: the result, the cancel notice and the
    // "❤️ 1/2 [code]" heart counter (recalled with the card). Nothing more to send from here.
    await this.confirmationService.handleReaction({
      chatId: threadId,
      userId: senderId,
      reactionIcon: icon,
      msgId: targetMsgId ? String(targetMsgId) : undefined,
      cliMsgId: targetCliMsgId ? String(targetCliMsgId) : undefined,
    });
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

      const msgType = readTextField(msgData.msgType);
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
      const msgId = readTextField(msgData.msgId) || readTextField(msgData.cliMsgId);
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
        const senderId = readTextField(msgData.uidFrom) || 'unknown';
        const displayName = readTextField(msgData.dName);
        const target = getThreadStorageTarget(config);
        const photosAlbumTitle = target.photosAlbumTitle;

        const uploadOptions = {
          msgId: msgId || undefined,
          filename: originalFilename,
          note: `Sao lưu lịch sử từ ${displayName || senderId} trong nhóm ${config.threadName || threadId}`,
        };

        let dualResult;
        if (isImage) {
          dualResult = await this.mediaStorageService.uploadImage(
            senderId,
            buffer,
            target,
            uploadOptions,
          );
        } else if (isVideo) {
          dualResult = await this.mediaStorageService.uploadVideo(
            senderId,
            buffer,
            target,
            uploadOptions,
          );
        } else {
          dualResult = await this.mediaStorageService.uploadFile(
            senderId,
            buffer,
            target,
            uploadOptions,
          );
        }

        if (dualResult.drive?.fileId) {
          syncedCount++;
          if (msgId) {
            await this.markMediaSynced(threadId, msgId);
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
