import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { ZaloService } from '../zalo/zalo.service';
import { ThreadConfigService } from './thread-config.service';
import { ZcaBotFeatureService } from './zca-bot-feature.service';
import { RedisService } from '../redis/redis.service';
import {
  Zalo,
  type API,
  type Credentials,
  type LoginQRCallback,
  type Message,
  type Reaction,
  type GroupEvent,
  type FriendEvent,
  type ImageMetadataGetter,
  LoginQRCallbackEventType,
  type LoginQRCallbackEvent,
} from 'zca-js';
import {
  ThreadType,
  Reactions,
  type Undo,
  type Typing,
  type SeenMessage,
  type DeliveredMessage,
  type MessageContent,
  type SendMessageResponse,
  type SendStickerPayload,
  type SendStickerResponse,
  type SendCardOptions,
  type SendCardResponse,
  type SendLinkOptions,
  type SendLinkResponse,
  type SendTypingEventResponse,
  type SendSeenEventMessageParams,
  type SendSeenEventResponse,
  type SendDeliveredEventMessageParams,
  type SendDeliveredEventResponse,
  type AddReactionResponse,
  type UndoPayload,
  type UndoResponse,
  type DeleteMessageDestination,
  type DeleteMessageResponse,
} from './shapes';
import { HttpProxyAgent } from 'http-proxy-agent';
import { ZCA_DEFAULT_USER_AGENT, ZCA_MODULE_OPTIONS } from './zca.constants';
import type { ZcaModuleOptions, ZcaPlugin } from './zca.interfaces';
import { createSharpImageMetadataGetter } from './zca-metadata.util';
import { createFetchPolyfill } from './utils';
import { GroupEventDispatcher } from './group-event-dispatcher.service';
import {
  WelcomeGroupEventStrategy,
  type WelcomeStrategyOptions,
} from './strategies/welcome-group-event.strategy';

function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return JSON.stringify(err);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return `[Unstringifiable payload: ${formatErrorMessage(err)}]`;
  }
}

export type QrLoginPhase =
  | 'idle'
  | 'generating'
  | 'qr_ready'
  | 'scanned'
  | 'confirmed'
  | 'logging_in'
  | 'success'
  | 'failed'
  | 'expired'
  | 'declined';

export interface QrLoginStatusInfo {
  phase: QrLoginPhase;
  message: string;
  scannedBy?: string;
  scannedAvatar?: string;
  code?: string;
  error?: string;
  updatedAt: number;
}

export interface AvailableThread {
  id: string;
  name: string;
  type: 'user' | 'group';
  isListened: boolean;
  avatar?: string;
  alias?: string;
  displayName?: string;
  zaloName?: string;
  phoneNumber?: string;
  totalMembers?: number;
}

@Injectable()
export class ZcaService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ZcaService.name);
  private client: Zalo;
  private api: API | null = null;
  private isListening = false;
  private plugins: ZcaPlugin[] = [];
  private proxyUrl?: string;
  private readonly groupEventDispatcher: GroupEventDispatcher;

  private latestQrImageBase64: string | null = null;
  private latestQrCode: string | null = null;
  private listenedThreadIds = new Set<string>();
  private cachedAvailableThreads: AvailableThread[] = [];
  private cachedThreadsExpiresAt = 0;
  private pendingThreadsFetchPromise: Promise<AvailableThread[]> | null = null;
  private readonly sentBotSignatures = new Map<string, number>();
  private readonly sentBotMsgIds = new Map<string, number>();
  private readonly msgIdToCliMsgId = new Map<string, string>();
  private readonly knownThreadTypes = new Map<string, ThreadType>();

  private qrLoginStatus: QrLoginStatusInfo = {
    phase: 'idle',
    message: 'Chưa có yêu cầu đăng nhập QR nào',
    updatedAt: Date.now(),
  };

  private activeQrLoginPromise: Promise<API> | null = null;
  private activeQrCallbacks: {
    onQrGenerated?: (qrUrl: string, code: string) => void;
    onScanned?: (name: string) => void;
    onExpired?: () => void;
    onDeclined?: () => void;
    onSuccess?: (ownId: string) => void;
    onError?: (err: string) => void;
  }[] = [];

  private readonly dataDir: string;
  private readonly whitelistFilePath: string;
  private readonly sessionFilePath: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(ZCA_MODULE_OPTIONS)
    private readonly moduleOptions?: ZcaModuleOptions,
    @Optional()
    groupEventDispatcher?: GroupEventDispatcher,
    @Optional()
    @Inject(forwardRef(() => ZcaBotFeatureService))
    private readonly botFeaturePlugin?: ZcaBotFeatureService,
    @Optional()
    private readonly threadConfigService?: ThreadConfigService,
    @Optional()
    private readonly redisService?: RedisService,
  ) {
    const configuredDataDir =
      this.moduleOptions?.dataDir ??
      this.configService.get<string>('zca.dataDir') ??
      this.configService.get<string>('DATA_DIR') ??
      process.env.DATA_DIR ??
      process.env.ZCA_DATA_DIR;

    if (configuredDataDir) {
      this.dataDir = path.resolve(process.cwd(), configuredDataDir);
    } else if (fs.existsSync(path.resolve(process.cwd(), 'data'))) {
      this.dataDir = path.resolve(process.cwd(), 'data');
    } else {
      this.dataDir = process.cwd();
    }

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (dirErr) {
      this.logger.warn(
        `Could not create data directory ${this.dataDir}: ${formatErrorMessage(dirErr)}`,
      );
    }

    this.sessionFilePath = path.resolve(this.dataDir, '.zca-session.json');
    this.whitelistFilePath = path.resolve(this.dataDir, '.zca-listened-threads.json');

    this.groupEventDispatcher =
      groupEventDispatcher ??
      new GroupEventDispatcher(new WelcomeGroupEventStrategy(this.configService));
    this.proxyUrl =
      this.moduleOptions?.proxyUrl ??
      this.configService.get<string>('zca.proxyUrl') ??
      process.env.ZCA_PROXY_URL ??
      undefined;

    const selfListen =
      this.moduleOptions?.selfListen ?? this.configService.get<boolean>('zca.selfListen') ?? false;

    const checkUpdate =
      this.moduleOptions?.checkUpdate ??
      this.configService.get<boolean>('zca.checkUpdate') ??
      false;

    const logging =
      this.moduleOptions?.logging ?? this.configService.get<boolean>('zca.logging') ?? true;

    let imageMetadataGetter: ImageMetadataGetter | undefined =
      this.moduleOptions?.imageMetadataGetter;

    if (!imageMetadataGetter && this.moduleOptions?.enableSharpMetadata !== false) {
      imageMetadataGetter = createSharpImageMetadataGetter();
    }

    const agent = this.proxyUrl ? new HttpProxyAgent(this.proxyUrl) : undefined;

    if (this.proxyUrl) {
      this.logger.log(`Initialized ZCA client with proxy: ${this.proxyUrl}`);
    } else {
      this.logger.log('Initialized ZCA client without proxy (direct connection)');
    }

    this.client = new Zalo({
      agent,
      polyfill: createFetchPolyfill(agent),
      selfListen,
      checkUpdate,
      logging,
      imageMetadataGetter,
    });

    if (this.moduleOptions?.plugins?.length) {
      this.registerPlugins(this.moduleOptions.plugins);
    }

    if (this.botFeaturePlugin) {
      this.registerPlugin(this.botFeaturePlugin);
    }
  }

  public getQrLoginStatus(): QrLoginStatusInfo {
    return this.qrLoginStatus;
  }

  private setQrStatus(
    phase: QrLoginPhase,
    message: string,
    extra?: Partial<QrLoginStatusInfo>,
  ): void {
    this.qrLoginStatus = {
      phase,
      message,
      scannedBy: extra?.scannedBy ?? this.qrLoginStatus.scannedBy,
      scannedAvatar: extra?.scannedAvatar ?? this.qrLoginStatus.scannedAvatar,
      code: extra?.code ?? this.qrLoginStatus.code,
      error: extra?.error,
      updatedAt: Date.now(),
    };
  }

  private async saveSessionToFile(session: {
    imei: string;
    cookie: unknown;
    userAgent: string;
  }): Promise<void> {
    try {
      const dir = path.dirname(this.sessionFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.sessionFilePath,
        JSON.stringify({ ...session, savedAt: new Date().toISOString() }, null, 2),
        'utf-8',
      );
      this.logger.log(`[ZCA] Đã lưu thông tin phiên ZCA vào file: ${this.sessionFilePath}`);
    } catch (err) {
      this.logger.warn(`[ZCA] Không thể lưu file session: ${formatErrorMessage(err)}`);
    }

    if (this.redisService?.isReady) {
      try {
        await this.redisService.set(
          'zca:session',
          JSON.stringify({ ...session, savedAt: new Date().toISOString() }),
        );
        this.logger.log(`[ZCA] Đã sao lưu phiên ZCA vào Redis (key: zca:session)`);
      } catch (redisErr) {
        this.logger.warn(`[ZCA] Không thể lưu phiên vào Redis: ${formatErrorMessage(redisErr)}`);
      }
    }
  }

  public loadSessionFromFile(): {
    imei: string;
    cookie: Credentials['cookie'];
    userAgent: string;
  } | null {
    // 1. Try primary session file
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const raw = fs.readFileSync(this.sessionFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as {
          imei?: string;
          cookie?: Credentials['cookie'];
          userAgent?: string;
        };
        if (parsed?.imei && parsed?.cookie) {
          return {
            imei: parsed.imei,
            cookie: parsed.cookie,
            userAgent: parsed.userAgent ?? ZCA_DEFAULT_USER_AGENT,
          };
        }
      }
    } catch (err) {
      this.logger.warn(`[ZCA] Không thể đọc file session: ${formatErrorMessage(err)}`);
    }

    // 2. Fallback to legacy root file if different from sessionFilePath
    const legacyPath = path.resolve(process.cwd(), '.zca-session.json');
    if (legacyPath !== this.sessionFilePath && fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, 'utf-8');
        const parsed = JSON.parse(raw) as {
          imei?: string;
          cookie?: Credentials['cookie'];
          userAgent?: string;
        };
        if (parsed?.imei && parsed?.cookie) {
          this.logger.log(
            `[ZCA] Tìm thấy phiên cũ ở ${legacyPath}, đang đồng bộ sang ${this.sessionFilePath}...`,
          );
          const session = {
            imei: parsed.imei,
            cookie: parsed.cookie,
            userAgent: parsed.userAgent ?? ZCA_DEFAULT_USER_AGENT,
          };
          void this.saveSessionToFile(session);
          return session;
        }
      } catch (err) {
        this.logger.warn(`[ZCA] Không thể đọc file session cũ: ${formatErrorMessage(err)}`);
      }
    }

    return null;
  }

  private async loadSavedSession(): Promise<{
    imei: string;
    cookie: Credentials['cookie'];
    userAgent: string;
  } | null> {
    const fileSession = this.loadSessionFromFile();
    if (fileSession) {
      return fileSession;
    }

    // 3. Fallback to Redis cache
    if (this.redisService?.isReady) {
      try {
        const rawRedis = await this.redisService.get('zca:session');
        if (rawRedis) {
          const parsed = JSON.parse(rawRedis) as {
            imei?: string;
            cookie?: Credentials['cookie'];
            userAgent?: string;
          };
          if (parsed?.imei && parsed?.cookie) {
            this.logger.log(`[ZCA] Khôi phục phiên ZCA thành công từ Redis (key: zca:session).`);
            const session = {
              imei: parsed.imei,
              cookie: parsed.cookie,
              userAgent: parsed.userAgent ?? ZCA_DEFAULT_USER_AGENT,
            };
            void this.saveSessionToFile(session);
            return session;
          }
        }
      } catch (err) {
        this.logger.warn(`[ZCA] Không thể đọc phiên từ Redis: ${formatErrorMessage(err)}`);
      }
    }

    return null;
  }

  public async onModuleInit(): Promise<void> {
    await this.loadListenedThreads();
  }

  /**
   * ZcaModule bootstraps strictly after ZaloModule is fully initialized,
   * ensuring that any direct dependencies on ZaloService are ready.
   */
  public async onApplicationBootstrap(): Promise<void> {
    this.logger.log('ZcaService bootstrapped after ZaloModule.');

    const autoLogin =
      this.moduleOptions?.autoLogin ?? this.configService.get<boolean>('zca.autoLogin') ?? false;

    if (autoLogin) {
      this.logger.log(
        'Auto-login enabled. Attempting ZCA login after ZaloModule initialization...',
      );
      try {
        await this.login();
      } catch (err) {
        this.logger.error(`ZCA auto-login failed: ${formatErrorMessage(err)}`);
      }
    } else {
      const savedSession = await this.loadSavedSession();
      if (savedSession) {
        this.logger.log(
          `Tìm thấy phiên ZCA đã lưu (${this.sessionFilePath}). Tự động khôi phục kết nối...`,
        );
        try {
          await this.login();
        } catch (err) {
          this.logger.warn(`Không thể tự khôi phục phiên đã lưu: ${formatErrorMessage(err)}`);
        }
      }
    }
  }

  public async onModuleDestroy(): Promise<void> {
    this.stopListener();
    await this.destroyPlugins();
  }

  /**
   * Returns the official ZaloService instance that ZCA depends on.
   */
  public getZaloService(): ZaloService | undefined {
    return undefined;
  }

  /**
   * Returns the underlying Zalo instance.
   */
  public getClient(): Zalo {
    return this.client;
  }

  /**
   * Returns the active ZCA API instance once logged in.
   */
  public getApi(): API | null {
    return this.api;
  }

  /**
   * Checks if ZCA is currently authenticated.
   */
  public isLoggedIn(): boolean {
    return this.api !== null;
  }

  /**
   * Returns own account ID if authenticated.
   */
  public getOwnId(): string | null {
    return this.api && typeof this.api.getOwnId === 'function' ? this.api.getOwnId() : null;
  }

  /**
   * Returns whether real-time event listener is running.
   */
  public isListenerActive(): boolean {
    return this.isListening;
  }

  /**
   * Get all registered plugins.
   */
  public getPlugins(): readonly ZcaPlugin[] {
    return this.plugins;
  }

  /**
   * Register a new plugin for message and event handling.
   */
  public registerPlugin(plugin: ZcaPlugin): this {
    const existing = this.plugins.find((p) => p.name === plugin.name);
    if (existing) {
      this.logger.warn(`Plugin "${plugin.name}" is already registered. Overwriting.`);
      this.plugins = this.plugins.filter((p) => p.name !== plugin.name);
    }
    this.plugins.push(plugin);
    this.logger.log(`Registered ZCA plugin: ${plugin.name}`);

    if (this.api && plugin.init) {
      void Promise.resolve(plugin.init(this, this.api)).catch((err) => {
        this.logger.error(
          `Failed to initialize plugin "${plugin.name}": ${formatErrorMessage(err)}`,
        );
      });
    }

    return this;
  }

  /**
   * Register multiple plugins at once.
   */
  public registerPlugins(plugins: ZcaPlugin[]): this {
    for (const plugin of plugins) {
      this.registerPlugin(plugin);
    }
    return this;
  }

  public resolveThreadType(threadId: string): ThreadType {
    const strId = String(threadId).trim();
    const known = this.knownThreadTypes.get(strId);
    if (known !== undefined) {
      return known;
    }
    const cached = this.cachedAvailableThreads.find((t) => t.id === strId);
    if (cached) {
      const type = cached.type === 'group' ? ThreadType.Group : ThreadType.User;
      this.knownThreadTypes.set(strId, type);
      return type;
    }
    const config = this.threadConfigService?.getConfigSync?.(strId);
    if (config?.threadType === 'group' || strId.startsWith('g-')) {
      return ThreadType.Group;
    }
    return ThreadType.User;
  }

  public trackBotOutgoingMessage(threadId: string, text: string): void {
    const cleanText = text.trim();
    if (!cleanText) return;
    const signature = `${threadId}:${cleanText}`;
    this.sentBotSignatures.set(signature, Date.now() + 120_000);
    this.cleanExpiredTracking();
  }

  public trackBotMsgId(msgId: string): void {
    if (!msgId) return;
    this.sentBotMsgIds.set(String(msgId), Date.now() + 120_000);
    this.cleanExpiredTracking();
  }

  public trackMsgCliId(msgId: string, cliMsgId: string): void {
    if (!msgId || !cliMsgId) return;
    const strMsgId = String(msgId);
    const strCliMsgId = String(cliMsgId);
    this.msgIdToCliMsgId.set(strMsgId, strCliMsgId);
    if (this.redisService) {
      void this.redisService.set(`zca:msg:cli:${strMsgId}`, strCliMsgId, 86400);
    }
  }

  public async getCliMsgId(msgId: string): Promise<string | undefined> {
    if (!msgId) return undefined;
    const strMsgId = String(msgId);
    const inMem = this.msgIdToCliMsgId.get(strMsgId);
    if (inMem) return inMem;
    if (this.redisService) {
      try {
        const fromRedis = await this.redisService.get(`zca:msg:cli:${strMsgId}`);
        if (fromRedis) {
          this.msgIdToCliMsgId.set(strMsgId, fromRedis);
          return fromRedis;
        }
      } catch {
        // Ignore redis lookup error
      }
    }
    return undefined;
  }

  public isBotSentMessage(message: Message): boolean {
    if (!message) return false;
    const msgId = message.data?.msgId ? String(message.data.msgId) : '';
    if (msgId && this.sentBotMsgIds.has(msgId)) {
      this.sentBotMsgIds.delete(msgId);
      return true;
    }

    const text = (typeof message.data?.content === 'string' ? message.data.content : '').trim();
    if (text) {
      const signature = `${message.threadId}:${text}`;
      if (this.sentBotSignatures.has(signature)) {
        this.sentBotSignatures.delete(signature);
        return true;
      }
    }
    return false;
  }

  private cleanExpiredTracking(): void {
    const now = Date.now();
    if (this.sentBotSignatures.size > 200) {
      for (const [key, expires] of this.sentBotSignatures.entries()) {
        if (now > expires) this.sentBotSignatures.delete(key);
      }
    }
    if (this.sentBotMsgIds.size > 200) {
      for (const [key, expires] of this.sentBotMsgIds.entries()) {
        if (now > expires) this.sentBotMsgIds.delete(key);
      }
    }
  }

  private setupApiInstance(api: API): API {
    const originalSendMessage = api.sendMessage.bind(api);
    api.sendMessage = async (
      message: MessageContent | string,
      threadId: string,
      type?: ThreadType,
    ) => {
      const resolvedType = type ?? this.resolveThreadType(threadId);
      const text = typeof message === 'string' ? message : message.msg || '';
      if (text) {
        this.trackBotOutgoingMessage(threadId, text);
      }
      const response = await originalSendMessage(message, threadId, resolvedType);
      if (response?.message?.msgId) {
        this.trackBotMsgId(String(response.message.msgId));
      }
      return response;
    };
    return api;
  }

  /**
   * Log in to Zalo using session credentials (cookies, imei, userAgent).
   */
  public async login(credentials?: Partial<Credentials>): Promise<API> {
    let rawCookie =
      credentials?.cookie ??
      this.moduleOptions?.cookie ??
      this.configService.get<string>('zca.cookie') ??
      process.env.ZCA_COOKIE;

    let imei =
      credentials?.imei ??
      this.moduleOptions?.imei ??
      this.configService.get<string>('zca.imei') ??
      process.env.ZCA_IMEI;

    let userAgent =
      credentials?.userAgent ??
      this.moduleOptions?.userAgent ??
      this.configService.get<string>('zca.userAgent') ??
      process.env.ZCA_USER_AGENT ??
      ZCA_DEFAULT_USER_AGENT;

    const language =
      credentials?.language ??
      this.moduleOptions?.language ??
      this.configService.get<string>('zca.language') ??
      process.env.ZCA_LANGUAGE;

    if (!imei || !rawCookie) {
      const savedSession = await this.loadSavedSession();
      if (savedSession) {
        this.logger.log(`[ZCA] Đọc phiên đăng nhập từ file đã lưu: ${this.sessionFilePath}`);
        imei = imei || savedSession.imei;
        rawCookie = rawCookie || savedSession.cookie;
        userAgent = userAgent || savedSession.userAgent;
      }
    }

    if (!imei) {
      throw new Error('ZCA login failed: IMEI is required (configure ZCA_IMEI).');
    }

    if (!rawCookie) {
      throw new Error('ZCA login failed: Cookies are required (configure ZCA_COOKIE).');
    }

    let cookie = rawCookie;
    if (typeof rawCookie === 'string') {
      try {
        cookie = JSON.parse(rawCookie) as Credentials['cookie'];
      } catch {
        this.logger.warn('Failed to parse ZCA_COOKIE as JSON. Passing as-is to zca-js.');
      }
    }

    const fullCredentials: Credentials = {
      imei,
      cookie: cookie as Credentials['cookie'],
      userAgent,
      language,
    };

    this.logger.log(`Logging in to Zalo via credentials (IMEI: ${imei.slice(0, 8)}...)...`);
    const api = await this.client.login(fullCredentials);
    this.api = this.setupApiInstance(api);

    this.logger.log('Successfully logged in to Zalo via ZCA.');
    await this.initPlugins(api);
    this.startListener();

    return api;
  }

  /**
   * Starts a QR login flow with callbacks for generated QR URL, scan status, and success.
   */
  public async startQrLogin(
    callbacks?: {
      onQrGenerated?: (qrUrl: string, code: string) => void;
      onScanned?: (name: string) => void;
      onExpired?: () => void;
      onDeclined?: () => void;
      onSuccess?: (ownId: string) => void;
      onError?: (err: string) => void;
    },
    options?: { forceNew?: boolean },
  ): Promise<API> {
    const appUrl =
      this.configService.get<string>('appUrl') || process.env.APP_URL || 'http://localhost:3005';
    const qrEndpointUrl = `${appUrl.replace(/\/+$/, '')}/api/zca/qr`;

    if (this.isLoggedIn()) {
      const ownId = this.getOwnId() || 'unknown';
      this.logger.log(`[ZCA QR] Tài khoản đã đăng nhập trước đó (Own ID: ${ownId}).`);
      this.setQrStatus('success', `Đã đăng nhập thành công với tài khoản: ${ownId}`);
      callbacks?.onSuccess?.(ownId);
      return this.api;
    }

    if (callbacks) {
      this.activeQrCallbacks.push(callbacks);
    }

    // Reuse active promise if one is already running and not failed/expired, unless forceNew requested
    if (
      this.activeQrLoginPromise !== null &&
      !options?.forceNew &&
      this.qrLoginStatus.phase !== 'failed' &&
      this.qrLoginStatus.phase !== 'expired' &&
      this.qrLoginStatus.phase !== 'declined'
    ) {
      this.logger.log(
        `[ZCA QR] Tái sử dụng tiến trình đăng nhập QR đang chạy (Trạng thái: ${this.qrLoginStatus.phase})...`,
      );
      if (this.latestQrCode) {
        callbacks?.onQrGenerated?.(qrEndpointUrl, this.latestQrCode);
      }
      if (this.qrLoginStatus.scannedBy) {
        callbacks?.onScanned?.(this.qrLoginStatus.scannedBy);
      }
      return this.activeQrLoginPromise;
    }

    const userAgent =
      this.moduleOptions?.userAgent ??
      this.configService.get<string>('zca.userAgent') ??
      process.env.ZCA_USER_AGENT ??
      ZCA_DEFAULT_USER_AGENT;

    this.logger.log('='.repeat(65));
    this.logger.log('           [ZCA QR LOGIN] BẮT ĐẦU LUỒNG ĐĂNG NHẬP MÃ QR           ');
    this.logger.log('='.repeat(65));
    this.logger.log(`[ZCA QR] User-Agent: ${userAgent}`);
    this.logger.log(`[ZCA QR] Proxy: ${this.proxyUrl || 'Không sử dụng (Direct connection)'}`);
    this.logger.log(`[ZCA QR] Endpoint ảnh QR: ${qrEndpointUrl}`);

    this.setQrStatus('generating', 'Đang kết nối Zalo để tạo mã QR đăng nhập...');

    const loginPromise = (async () => {
      try {
        const api = await this.client.loginQR({ userAgent }, (event: LoginQRCallbackEvent) => {
          switch (event.type) {
            case LoginQRCallbackEventType.QRCodeGenerated: {
              this.latestQrImageBase64 = event.data.image;
              this.latestQrCode = event.data.code;
              this.setQrStatus(
                'qr_ready',
                'Mã QR đã sẵn sàng. Vui lòng quét mã trên ứng dụng Zalo điện thoại.',
                { code: event.data.code },
              );
              this.logger.log(`[ZCA QR] [Bước 1/3] ✅ Mã QR đã được tạo thành công!`);
              this.logger.log(`[ZCA QR] 👉 URL xem ảnh: ${qrEndpointUrl}`);
              this.logger.log(`[ZCA QR] 👉 Raw Code URL: ${event.data.code}`);
              this.logger.log(`[ZCA QR] 📱 Vui lòng mở ứng dụng Zalo điện thoại -> Quét mã QR.`);
              for (const cb of this.activeQrCallbacks) {
                cb.onQrGenerated?.(qrEndpointUrl, event.data.code);
              }
              break;
            }
            case LoginQRCallbackEventType.QRCodeScanned: {
              this.setQrStatus(
                'scanned',
                `Đã quét bởi "${event.data.display_name}". Vui lòng bấm "Xác nhận đăng nhập" trên điện thoại.`,
                {
                  scannedBy: event.data.display_name,
                  scannedAvatar: event.data.avatar,
                },
              );
              this.logger.log('='.repeat(65));
              this.logger.log(`[ZCA QR] [Bước 2/3] 📱 ĐÃ QUÉT MÃ QR THÀNH CÔNG!`);
              this.logger.log(`[ZCA QR] 👉 Tên người dùng: ${event.data.display_name}`);
              if (event.data.avatar) {
                this.logger.log(`[ZCA QR] 👉 Avatar: ${event.data.avatar}`);
              }
              this.logger.log(
                `[ZCA QR] ⏳ VUI LÒNG BẤM "XÁC NHẬN ĐĂNG NHẬP" (HOẶC "ĐĂNG NHẬP") TRÊN ỨNG DỤNG ZALO ĐIỆN THOẠI...`,
              );
              this.logger.log('='.repeat(65));
              for (const cb of this.activeQrCallbacks) {
                cb.onScanned?.(event.data.display_name);
              }
              break;
            }
            case LoginQRCallbackEventType.QRCodeExpired: {
              this.setQrStatus(
                'expired',
                'Mã QR đã hết hạn. Hệ thống đang tự động tạo lại mã mới...',
              );
              this.logger.warn(
                `[ZCA QR] ⏰ Mã QR đã hết hạn (sau 100s). Đang tự động tạo lại mã mới...`,
              );
              for (const cb of this.activeQrCallbacks) {
                cb.onExpired?.();
              }
              event.actions.retry();
              break;
            }
            case LoginQRCallbackEventType.QRCodeDeclined: {
              this.setQrStatus('declined', 'Đăng nhập đã bị từ chối trên thiết bị di động.');
              this.logger.warn(`[ZCA QR] ❌ Yêu cầu đăng nhập đã bị TỪ CHỐI trên điện thoại.`);
              for (const cb of this.activeQrCallbacks) {
                cb.onDeclined?.();
              }
              break;
            }
            case LoginQRCallbackEventType.GotLoginInfo: {
              this.setQrStatus(
                'logging_in',
                'Đã nhận thông tin xác thực từ điện thoại. Đang thiết lập phiên làm việc Zalo...',
              );
              this.logger.log('='.repeat(65));
              this.logger.log(`[ZCA QR] [Bước 3/3] 🔑 ĐÃ NHẬN THÔNG TIN ĐĂNG NHẬP (GotLoginInfo)!`);
              this.logger.log(`[ZCA QR] 👉 IMEI: ${event.data.imei}`);
              this.logger.log(`[ZCA QR] 👉 UserAgent: ${event.data.userAgent}`);
              const cookieCount = Array.isArray(event.data.cookie)
                ? event.data.cookie.length
                : event.data.cookie
                  ? Object.keys(event.data.cookie).length
                  : 0;
              this.logger.log(`[ZCA QR] 👉 Số lượng Cookie: ${cookieCount}`);
              this.logger.log('='.repeat(65));

              void this.saveSessionToFile({
                imei: event.data.imei,
                cookie: event.data.cookie,
                userAgent: event.data.userAgent,
              });
              break;
            }
          }
        });

        this.api = this.setupApiInstance(api);
        const ownId = typeof api.getOwnId === 'function' ? api.getOwnId() : 'unknown';
        this.setQrStatus('success', `Đăng nhập thành công! Tài khoản ID: ${ownId}`);
        this.logger.log('='.repeat(65));
        this.logger.log(`[ZCA QR] 🎉🎉🎉 ĐĂNG NHẬP ZALO CÁ NHÂN HOÀN TẤT THÀNH CÔNG! 🎉🎉🎉`);
        this.logger.log(`[ZCA QR] 👉 ID tài khoản ZCA: ${ownId}`);
        this.logger.log(`[ZCA QR] 👉 Đã kích hoạt lắng nghe tin nhắn & sự kiện nhóm.`);
        this.logger.log('='.repeat(65));
        for (const cb of this.activeQrCallbacks) {
          cb.onSuccess?.(ownId);
        }

        await this.initPlugins(api);
        this.startListener();
        return api;
      } catch (err: unknown) {
        const errMsg = formatErrorMessage(err);
        this.setQrStatus('failed', `Đăng nhập thất bại: ${errMsg}`, { error: errMsg });
        this.logger.error('='.repeat(65));
        this.logger.error(`[ZCA QR] 💥 LỖI ĐĂNG NHẬP ZCA: ${errMsg}`);
        if (err instanceof Error && err.stack) {
          this.logger.error(`[ZCA QR] Chi tiết lỗi:\n${err.stack}`);
        }
        this.logger.error('='.repeat(65));
        for (const cb of this.activeQrCallbacks) {
          cb.onError?.(errMsg);
        }
        throw err;
      } finally {
        this.activeQrLoginPromise = null;
        this.activeQrCallbacks = [];
      }
    })();

    this.activeQrLoginPromise = loginPromise;
    return loginPromise;
  }

  /**
   * Log in to Zalo via QR Code directly.
   */
  public async loginQR(
    options?: { userAgent?: string; language?: string; qrPath?: string },
    callback?: LoginQRCallback,
  ): Promise<API> {
    const userAgent =
      options?.userAgent ??
      this.moduleOptions?.userAgent ??
      this.configService.get<string>('zca.userAgent') ??
      process.env.ZCA_USER_AGENT ??
      ZCA_DEFAULT_USER_AGENT;

    this.logger.log('Initiating Zalo QR code login...');
    const api = await this.client.loginQR(
      {
        ...options,
        userAgent,
      },
      callback,
    );

    this.api = this.setupApiInstance(api);
    this.logger.log('Successfully logged in via QR Code.');
    await this.initPlugins(api);
    this.startListener();

    return api;
  }

  /**
   * Returns latest QR image buffer (for HTTP endpoint).
   */
  public getLatestQrBuffer(): Buffer | null {
    if (!this.latestQrImageBase64) return null;
    const base64Data = this.latestQrImageBase64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Returns latest QR text code.
   */
  public getLatestQrCode(): string | null {
    return this.latestQrCode;
  }

  /**
   * Whitelist Management: Get array of thread IDs currently listened to.
   */
  public getListenedThreadIds(): string[] {
    return Array.from(this.listenedThreadIds);
  }

  /**
   * Whitelist Management: Update listened thread IDs and persist.
   */
  public async setListenedThreadIds(ids: string[]): Promise<void> {
    this.listenedThreadIds = new Set(ids.map(String).filter(Boolean));
    await this.saveListenedThreads();
    if (this.threadConfigService) {
      for (const id of this.listenedThreadIds) {
        await this.threadConfigService.setListened(id, true);
      }
    }
    this.cachedAvailableThreads = this.cachedAvailableThreads.map((t) => ({
      ...t,
      isListened: this.listenedThreadIds.has(t.id),
    }));
    this.logger.log(`Updated listened threads count: ${this.listenedThreadIds.size}`);
  }

  /**
   * Whitelist Management: Toggle single thread ID and persist.
   */
  public async toggleListenedThread(id: string): Promise<boolean> {
    const strId = String(id).trim();
    if (!strId || strId === 'thread-123') return false;
    let enabled = false;
    if (this.listenedThreadIds.has(strId)) {
      this.listenedThreadIds.delete(strId);
      enabled = false;
      if (this.threadConfigService) {
        await this.threadConfigService.setListened(strId, false);
      }
    } else {
      this.listenedThreadIds.add(strId);
      enabled = true;
      if (this.threadConfigService) {
        await this.threadConfigService.setListened(strId, true);
      }
    }
    await this.saveListenedThreads();
    this.cachedAvailableThreads = this.cachedAvailableThreads.map((t) =>
      t.id === strId ? { ...t, isListened: enabled } : t,
    );
    this.logger.log(`Toggled listened thread ${strId}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return enabled;
  }

  /**
   * Returns all available groups & friends with isListened status.
   * Includes in-memory caching (3 mins TTL) to prevent Zalo rate limit (429).
   */
  public async getAvailableThreads(forceRefresh = false): Promise<AvailableThread[]> {
    if (!this.isLoggedIn()) {
      return [];
    }

    // 1. Return fresh cached copy if still valid and not explicitly forced
    if (
      !forceRefresh &&
      Date.now() < this.cachedThreadsExpiresAt &&
      this.cachedAvailableThreads.length > 0
    ) {
      return this.cachedAvailableThreads.map((t) => ({
        ...t,
        isListened: this.listenedThreadIds.has(t.id),
      }));
    }

    // 2. Reuse in-flight fetch promise if concurrent requests arrive
    if (this.pendingThreadsFetchPromise !== null) {
      const inFlight = await this.pendingThreadsFetchPromise;
      return inFlight.map((t) => ({
        ...t,
        isListened: this.listenedThreadIds.has(t.id),
      }));
    }

    // 3. Initiate fetch
    this.pendingThreadsFetchPromise = (async () => {
      const result: AvailableThread[] = [];
      const seenIds = new Set<string>();

      if (this.api) {
        // --- A. GROUPS ---
        try {
          const groups = await this.api.getAllGroups();
          if (groups && typeof groups === 'object') {
            let groupIds: string[] = [];
            const rawGroups = groups as Record<string, unknown>;
            if (Array.isArray(groups)) {
              groupIds = groups
                .map((g: Record<string, unknown>) => {
                  const idVal = g.groupId ?? g.id;
                  return typeof idVal === 'string' || typeof idVal === 'number'
                    ? String(idVal)
                    : '';
                })
                .filter(Boolean);
            } else if (rawGroups.gridVerMap && typeof rawGroups.gridVerMap === 'object') {
              groupIds = Object.keys(rawGroups.gridVerMap);
            } else {
              groupIds = Object.values(rawGroups)
                .map((g: unknown) => {
                  if (typeof g === 'object' && g !== null) {
                    const rec = g as Record<string, unknown>;
                    const idVal = rec.groupId ?? rec.id;
                    return typeof idVal === 'string' || typeof idVal === 'number'
                      ? String(idVal)
                      : '';
                  }
                  return '';
                })
                .filter(Boolean);
            }

            if (groupIds.length > 0) {
              const groupInfoMap: Record<string, Record<string, unknown>> = {};
              // Fetch detailed info in chunks of 50 to avoid any payload limits
              for (let i = 0; i < groupIds.length; i += 50) {
                const batch = groupIds.slice(i, i + 50);
                try {
                  const groupInfoRes = (await this.api.getGroupInfo(batch)) as {
                    gridInfoMap?: Record<string, Record<string, unknown>>;
                  };
                  if (groupInfoRes?.gridInfoMap) {
                    Object.assign(groupInfoMap, groupInfoRes.gridInfoMap);
                  }
                } catch (batchErr) {
                  this.logger.warn(
                    `Failed to fetch group info batch: ${formatErrorMessage(batchErr)}`,
                  );
                }
              }

              for (const gid of groupIds) {
                this.knownThreadTypes.set(gid, ThreadType.Group);
                if (seenIds.has(gid)) continue;
                seenIds.add(gid);
                const g = groupInfoMap[gid];
                if (g) {
                  const rawName = g.name ?? g.groupName;
                  const groupName = typeof rawName === 'string' ? rawName : `Nhóm ${gid}`;
                  const avatar =
                    typeof g.avt === 'string'
                      ? g.avt
                      : typeof g.fullAvt === 'string'
                        ? g.fullAvt
                        : undefined;
                  const totalMembers =
                    typeof g.totalMember === 'number' ? g.totalMember : undefined;

                  result.push({
                    id: gid,
                    name: groupName,
                    type: 'group',
                    isListened: this.listenedThreadIds.has(gid),
                    avatar,
                    totalMembers,
                  });
                } else {
                  result.push({
                    id: gid,
                    name: `Nhóm ${gid}`,
                    type: 'group',
                    isListened: this.listenedThreadIds.has(gid),
                  });
                }
              }
            }
          }
        } catch (err: unknown) {
          this.logger.warn(`Failed to fetch groups from ZCA: ${formatErrorMessage(err)}`);
        }

        // --- B. ALIASES (Tên gợi nhớ do người dùng đặt) ---
        const aliasMap = new Map<string, string>();
        try {
          const aliasRes = (await this.api.getAliasList()) as {
            items?: { userId?: string; alias?: string }[];
          };
          if (Array.isArray(aliasRes?.items)) {
            for (const item of aliasRes.items) {
              if (item?.userId && item?.alias) {
                aliasMap.set(String(item.userId), String(item.alias).trim());
              }
            }
          }
        } catch (err: unknown) {
          this.logger.debug(`Could not fetch alias list from ZCA: ${formatErrorMessage(err)}`);
        }

        // --- C. FRIENDS ---
        try {
          const friends = await this.api.getAllFriends();
          if (friends && typeof friends === 'object') {
            const friendList = Array.isArray(friends) ? friends : Object.values(friends);
            for (const f of friendList as Record<string, unknown>[]) {
              const rawId = f.userId ?? f.id;
              const userId =
                typeof rawId === 'string' ? rawId : typeof rawId === 'number' ? String(rawId) : '';
              if (!userId || seenIds.has(userId)) continue;
              seenIds.add(userId);
              this.knownThreadTypes.set(userId, ThreadType.User);

              const alias =
                aliasMap.get(userId) || (typeof f.alias === 'string' ? f.alias.trim() : undefined);
              const rawDisplayName = typeof f.displayName === 'string' ? f.displayName.trim() : '';
              const rawZaloName = typeof f.zaloName === 'string' ? f.zaloName.trim() : '';
              const phoneNumber =
                typeof f.phoneNumber === 'string' && f.phoneNumber.trim()
                  ? f.phoneNumber.trim()
                  : undefined;

              // Priority: Alias -> Display Name -> Zalo Name -> Placeholder
              const primaryName = alias || rawDisplayName || rawZaloName || `Người dùng ${userId}`;

              result.push({
                id: userId,
                name: primaryName,
                displayName:
                  rawDisplayName && rawDisplayName !== primaryName ? rawDisplayName : undefined,
                alias: alias && alias !== rawDisplayName ? alias : undefined,
                zaloName:
                  rawZaloName && rawZaloName !== primaryName && rawZaloName !== rawDisplayName
                    ? rawZaloName
                    : undefined,
                phoneNumber,
                type: 'user',
                isListened: this.listenedThreadIds.has(userId),
                avatar:
                  typeof f.avatar === 'string'
                    ? f.avatar
                    : typeof f.avt === 'string'
                      ? f.avt
                      : undefined,
              });
            }
          }
        } catch (err: unknown) {
          this.logger.warn(`Failed to fetch friends from ZCA: ${formatErrorMessage(err)}`);
        }

        // Include any aliased contacts not in friends list
        for (const [userId, alias] of aliasMap.entries()) {
          if (!seenIds.has(userId)) {
            seenIds.add(userId);
            result.push({
              id: userId,
              name: alias,
              alias,
              type: 'user',
              isListened: this.listenedThreadIds.has(userId),
            });
          }
        }
      }

      // --- D. WHITELIST FALLBACK (Any configured ID not in contacts) ---
      for (const id of this.listenedThreadIds) {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          result.push({
            id,
            name: `Cuộc trò chuyện ${id}`,
            type: 'group',
            isListened: true,
          });
        }
      }

      // If fetch succeeded, update cache
      if (result.length > 0) {
        this.cachedAvailableThreads = result;
        this.cachedThreadsExpiresAt = Date.now() + 180_000; // 3 minutes TTL
        return result;
      }

      // If fetch produced nothing (e.g. rate-limit or network glitch), keep existing cache
      if (this.cachedAvailableThreads.length > 0) {
        return this.cachedAvailableThreads.map((t) => ({
          ...t,
          isListened: this.listenedThreadIds.has(t.id),
        }));
      }

      return result;
    })();

    try {
      return await this.pendingThreadsFetchPromise;
    } finally {
      this.pendingThreadsFetchPromise = null;
    }
  }

  /**
   * Starts listening to incoming messages and events.
   * If listenedThreadIds is not empty, only messages & events from those threads will be processed.
   */
  public startListener(): void {
    if (!this.api) {
      this.logger.warn('Cannot start listener: ZCA is not logged in.');
      return;
    }

    if (this.isListening) {
      this.logger.debug('Listener is already running.');
      return;
    }

    const listener = this.api.listener;

    listener.on('connected', () => {
      this.logger.log('ZCA Realtime listener connected.');
    });

    listener.on('closed', (code, reason) => {
      this.logger.warn(`ZCA Realtime listener closed (code: ${code}, reason: ${reason}).`);
      this.isListening = false;
    });

    listener.on('error', (err: unknown) => {
      this.logger.error(`ZCA Realtime listener error: ${formatErrorMessage(err)}`);
    });

    // 1. Message listener (UserMessage | GroupMessage)
    listener.on('message', (message: Message) => {
      const threadId = message?.threadId ?? 'unknown';
      const isListened = this.listenedThreadIds.size === 0 || this.listenedThreadIds.has(threadId);
      const isGroup = message?.type === ThreadType.Group;
      this.knownThreadTypes.set(threadId, isGroup ? ThreadType.Group : ThreadType.User);
      if (message?.data?.msgId && message?.data?.cliMsgId) {
        this.trackMsgCliId(String(message.data.msgId), String(message.data.cliMsgId));
      }
      const typeLabel = isGroup ? 'Group' : 'User (Direct)';
      const senderName = message?.data?.dName || 'Unknown';
      const senderId = message?.data?.uidFrom || 'Unknown';
      const msgType = message?.data?.msgType || 'chat';
      const content =
        typeof message?.data?.content === 'string'
          ? message.data.content
          : safeStringify(message?.data?.content ?? '');

      this.logger.log(
        `📩 [ZCA on('message')] Nhận tin nhắn mới:\n` +
          `  • Thread ID: ${threadId} (${typeLabel})\n` +
          `  • Người gửi: ${senderName} (UID: ${senderId})\n` +
          `  • Loại tin nhắn: ${msgType}\n` +
          `  • Nội dung: ${content}\n` +
          `  • Gửi bởi bot (isSelf): ${Boolean(message?.isSelf)}\n` +
          `  • Listened: ${isListened ? 'Có' : 'Không (Bỏ qua do không nằm trong danh sách lắng nghe)'}`,
      );

      this.logger.log(`📦 [ZCA on('message') RAW PAYLOAD]:\n${safeStringify(message)}`);

      if (!isListened) {
        this.logger.warn(
          `⚠️ [ZCA on('message')] Bỏ qua tin nhắn từ thread ${threadId} vì không nằm trong danh sách lắng nghe (${Array.from(this.listenedThreadIds).join(', ') || 'trống'}).`,
        );
        return;
      }

      void this.dispatchMessage(message);
    });

    // 2. Reaction listener
    listener.on('reaction', (reaction: Reaction) => {
      if (reaction?.threadId) {
        this.knownThreadTypes.set(
          reaction.threadId,
          reaction.isGroup ? ThreadType.Group : ThreadType.User,
        );
      }
      const rMsg = reaction?.data?.content?.rMsg;
      if (rMsg?.[0]?.gMsgID && rMsg?.[0]?.cMsgID) {
        this.trackMsgCliId(String(rMsg[0].gMsgID), String(rMsg[0].cMsgID));
      }
      void this.dispatchReaction(reaction);
    });

    // 3. Group event listener (e.g. member joins -> Welcome strategy)
    listener.on('group_event', (event: GroupEvent) => {
      this.knownThreadTypes.set(event.threadId, ThreadType.Group);
      if (this.listenedThreadIds.size > 0 && !this.listenedThreadIds.has(event.threadId)) {
        this.logger.debug(
          `Group event from thread ${event.threadId} ignored (not in listened list)`,
        );
        return;
      }
      void this.dispatchGroupEvent(event);
    });

    // 4. Friend event listener
    listener.on('friend_event', (event: FriendEvent) => {
      void this.dispatchFriendEvent(event);
    });

    // 5. Undo listener
    listener.on('undo', (undo: Undo) => {
      void this.dispatchUndo(undo);
    });

    // 6. Typing indicator listener
    listener.on('typing', (typing: Typing) => {
      void this.dispatchTyping(typing);
    });

    // 7. Seen messages listener
    listener.on('seen_messages', (messages: SeenMessage[]) => {
      void this.dispatchSeenMessages(messages);
    });

    // 8. Delivered messages listener
    listener.on('delivered_messages', (messages: DeliveredMessage[]) => {
      void this.dispatchDeliveredMessages(messages);
    });

    listener.start();
    this.isListening = true;
    this.logger.log('ZCA Realtime listener started.');
  }

  /**
   * Stops listening to incoming messages and events.
   */
  public stopListener(): void {
    if (this.api && this.isListening) {
      try {
        this.api.listener.stop();
        this.logger.log('ZCA Realtime listener stopped.');
      } catch (err) {
        this.logger.warn(`Error stopping ZCA listener: ${formatErrorMessage(err)}`);
      }
      this.isListening = false;
    }
  }

  /**
   * Logs out from ZCA, stops the listener, cleans up session files and Redis cache.
   */
  public async logout(): Promise<{ success: boolean; message: string }> {
    this.logger.log('[ZCA] Đang thực hiện đăng xuất và ngắt kết nối tài khoản ZCA...');

    // 1. Dừng listener
    try {
      this.stopListener();
    } catch (err) {
      this.logger.warn(`[ZCA] Lỗi khi dừng listener: ${formatErrorMessage(err)}`);
    }

    // 2. Reset trạng thái bộ nhớ
    this.api = null;
    this.isListening = false;
    this.latestQrImageBase64 = null;
    this.latestQrCode = null;
    this.cachedAvailableThreads = [];
    this.cachedThreadsExpiresAt = 0;
    this.activeQrLoginPromise = null;
    this.qrLoginStatus = {
      phase: 'idle',
      message: 'Chưa có yêu cầu đăng nhập QR nào',
      updatedAt: Date.now(),
    };

    // 3. Xóa session file trên disk
    if (this.sessionFilePath) {
      try {
        if (fs.existsSync(this.sessionFilePath)) {
          fs.unlinkSync(this.sessionFilePath);
          this.logger.log(`[ZCA] Đã xóa file phiên: ${this.sessionFilePath}`);
        }
      } catch (err) {
        this.logger.warn(
          `[ZCA] Lỗi khi xóa file phiên ZCA (${this.sessionFilePath}): ${formatErrorMessage(err)}`,
        );
      }
    }
    try {
      const legacyPath = path.resolve(process.cwd(), '.zca-session.json');
      if (legacyPath !== this.sessionFilePath && fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
        this.logger.log(`[ZCA] Đã xóa file phiên cũ: ${legacyPath}`);
      }
    } catch (err) {
      this.logger.warn(`[ZCA] Lỗi khi xóa file phiên ZCA cũ: ${formatErrorMessage(err)}`);
    }

    // 4. Xóa session trong Redis
    try {
      if (this.redisService) {
        await this.redisService.del('zca:session');
        this.logger.log('[ZCA] Đã xóa phiên ZCA khỏi Redis (key: zca:session)');
      }
    } catch (err) {
      this.logger.warn(`[ZCA] Lỗi khi xóa session khỏi Redis: ${formatErrorMessage(err)}`);
    }

    return {
      success: true,
      message: 'Đã đăng xuất tài khoản ZCA và xóa phiên làm việc thành công.',
    };
  }

  /**
   * Helper to send a message via active API.
   */
  public async sendMessage(
    message: MessageContent | string,
    threadId: string,
    type?: ThreadType,
  ): Promise<SendMessageResponse> {
    if (!this.api) {
      throw new Error('Cannot send message: ZCA is not logged in.');
    }
    const resolvedType = type ?? this.resolveThreadType(threadId);
    return this.api.sendMessage(message, threadId, resolvedType);
  }

  /**
   * Helper to send sticker via active API.
   */
  public async sendSticker(
    payload: SendStickerPayload,
    threadId: string,
    type?: ThreadType,
  ): Promise<SendStickerResponse> {
    if (!this.api) {
      throw new Error('Cannot send sticker: ZCA is not logged in.');
    }
    return this.api.sendSticker(payload, threadId, type);
  }

  /**
   * Helper to send a contact card via active API.
   */
  public async sendCard(
    options: SendCardOptions,
    threadId: string,
    type?: ThreadType,
  ): Promise<SendCardResponse> {
    if (!this.api) {
      throw new Error('Cannot send card: ZCA is not logged in.');
    }
    return this.api.sendCard(options, threadId, type);
  }

  /**
   * Helper to send a link preview via active API.
   */
  public async sendLink(
    options: SendLinkOptions,
    threadId: string,
    type?: ThreadType,
  ): Promise<SendLinkResponse> {
    if (!this.api) {
      throw new Error('Cannot send link: ZCA is not logged in.');
    }
    return this.api.sendLink(options, threadId, type);
  }

  /**
   * Helper to send typing indicator via active API.
   */
  public async sendTyping(threadId: string, type?: ThreadType): Promise<SendTypingEventResponse> {
    if (!this.api) {
      throw new Error('Cannot send typing event: ZCA is not logged in.');
    }
    return this.api.sendTypingEvent(threadId, type);
  }

  /**
   * Helper to send seen event via active API.
   */
  public async sendSeen(
    params: SendSeenEventMessageParams,
    type?: ThreadType,
  ): Promise<SendSeenEventResponse> {
    if (!this.api) {
      throw new Error('Cannot send seen event: ZCA is not logged in.');
    }
    return this.api.sendSeenEvent(params, type);
  }

  /**
   * Helper to send delivered event via active API.
   */
  public async sendDelivered(
    params: SendDeliveredEventMessageParams | SendDeliveredEventMessageParams[],
    isSeen = false,
    type?: ThreadType,
  ): Promise<SendDeliveredEventResponse> {
    if (!this.api) {
      throw new Error('Cannot send delivered event: ZCA is not logged in.');
    }
    return this.api.sendDeliveredEvent(isSeen, params, type);
  }

  /**
   * Helper to add a reaction to a message via active API.
   */
  public async addReaction(
    reaction: Reactions | string,
    message:
      | Message
      | {
          msgId: string;
          cliMsgId: string;
          threadId: string;
          type: ThreadType;
        },
  ): Promise<AddReactionResponse> {
    if (!this.api) {
      throw new Error('Cannot add reaction: ZCA is not logged in.');
    }
    const msgId = 'data' in message ? message.data.msgId : message.msgId;
    const cliMsgId = 'data' in message ? message.data.cliMsgId : message.cliMsgId;
    return this.api.addReaction(reaction as Reactions, {
      data: {
        msgId,
        cliMsgId,
      },
      threadId: message.threadId,
      type: message.type,
    });
  }

  /**
   * Helper to undo (unsend) a message via active API.
   */
  public async undo(
    payload: UndoPayload,
    threadId: string,
    type?: ThreadType,
  ): Promise<UndoResponse> {
    if (!this.api) {
      throw new Error('Cannot undo message: ZCA is not logged in.');
    }
    const resolvedType = type ?? this.resolveThreadType(threadId);
    let cliMsgId = payload.cliMsgId;
    if (!cliMsgId || String(cliMsgId) === String(payload.msgId)) {
      const cachedCli = await this.getCliMsgId(String(payload.msgId));
      if (cachedCli) {
        cliMsgId = cachedCli;
      }
    }
    return this.api.undo(
      {
        msgId: payload.msgId,
        cliMsgId: cliMsgId || payload.msgId,
      },
      threadId,
      resolvedType,
    );
  }

  /**
   * Helper to delete a message via active API.
   * - onlyMe: true -> deletes message only for bot side
   * - onlyMe: false -> deletes message for everyone (only works if bot is group admin deleting other members' messages)
   */
  public async deleteMessage(
    dest: DeleteMessageDestination,
    onlyMe = false,
  ): Promise<DeleteMessageResponse> {
    if (!this.api) {
      throw new Error('Cannot delete message: ZCA is not logged in.');
    }
    const resolvedType = dest.type ?? this.resolveThreadType(dest.threadId);
    return this.api.deleteMessage(
      {
        ...dest,
        type: resolvedType,
      },
      onlyMe,
    );
  }

  /**
   * Dispatch message to all registered plugins.
   */
  public async dispatchMessage(message: Message): Promise<void> {
    if (!this.api) return;

    if (this.plugins.length === 0) {
      this.logger.debug(
        `[ZCA dispatchMessage] Đã nhận tin nhắn từ thread ${message?.threadId ?? 'unknown'} nhưng chưa có ZcaPlugin nào được đăng ký để xử lý.`,
      );
      return;
    }

    for (const plugin of this.plugins) {
      if (plugin.onMessage) {
        try {
          this.logger.debug(
            `[ZCA dispatchMessage] Chuyển tiếp tin nhắn tới plugin "${plugin.name}"...`,
          );
          await plugin.onMessage(message, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onMessage: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  /**
   * Dispatch reaction to all registered plugins.
   */
  public async dispatchReaction(reaction: Reaction): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onReaction) {
        try {
          await plugin.onReaction(reaction, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onReaction: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  /**
   * Dispatch group event to registered strategies and plugins.
   */
  public async dispatchGroupEvent(event: GroupEvent): Promise<void> {
    if (!this.api) return;

    await this.groupEventDispatcher.dispatch(event, this.api);

    for (const plugin of this.plugins) {
      if (plugin.onGroupEvent) {
        try {
          await plugin.onGroupEvent(event, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onGroupEvent: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  /**
   * Configures or re-initializes the Welcome strategy.
   */
  public initWelcome(options?: WelcomeStrategyOptions): WelcomeGroupEventStrategy {
    const strategy = new WelcomeGroupEventStrategy(this.configService, options);
    this.groupEventDispatcher.registerStrategy(strategy);
    return strategy;
  }

  /**
   * Get the group event dispatcher to inspect or register custom strategies.
   */
  public getGroupEventDispatcher(): GroupEventDispatcher {
    return this.groupEventDispatcher;
  }

  /**
   * Dispatch friend event to all registered plugins.
   */
  public async dispatchFriendEvent(event: FriendEvent): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onFriendEvent) {
        try {
          await plugin.onFriendEvent(event, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onFriendEvent: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  /**
   * Dispatch undo (unsend) event to all registered plugins.
   */
  public async dispatchUndo(undo: Undo): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onUndo) {
        try {
          await plugin.onUndo(undo, this.api);
        } catch (err) {
          this.logger.error(`Error in plugin "${plugin.name}" onUndo: ${formatErrorMessage(err)}`);
        }
      }
    }
  }

  /**
   * Dispatch typing event to all registered plugins.
   */
  public async dispatchTyping(typing: Typing): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onTyping) {
        try {
          await plugin.onTyping(typing, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onTyping: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  /**
   * Dispatch seen messages event to all registered plugins.
   */
  public async dispatchSeenMessages(messages: SeenMessage[]): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onSeenMessages) {
        try {
          await plugin.onSeenMessages(messages, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onSeenMessages: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  /**
   * Dispatch delivered messages event to all registered plugins.
   */
  public async dispatchDeliveredMessages(messages: DeliveredMessage[]): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onDeliveredMessages) {
        try {
          await plugin.onDeliveredMessages(messages, this.api);
        } catch (err) {
          this.logger.error(
            `Error in plugin "${plugin.name}" onDeliveredMessages: ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  private async loadListenedThreads(): Promise<void> {
    try {
      if (this.threadConfigService) {
        await this.threadConfigService.loadConfigs();
        const ids = this.threadConfigService.getListenedThreadIds();
        this.listenedThreadIds = new Set(ids.filter((id) => id !== 'thread-123'));
      } else {
        const filePath = fs.existsSync(this.whitelistFilePath)
          ? this.whitelistFilePath
          : path.resolve(process.cwd(), '.zca-listened-threads.json');

        if (fs.existsSync(filePath)) {
          const content = await fs.promises.readFile(filePath, 'utf8');
          const parsed = JSON.parse(content) as string[];
          if (Array.isArray(parsed)) {
            this.listenedThreadIds = new Set(
              parsed.map(String).filter((id) => Boolean(id) && id !== 'thread-123'),
            );
          }
        }
      }
      this.logger.log(`Loaded ${this.listenedThreadIds.size} listened threads.`);
    } catch (err: unknown) {
      this.logger.warn(`Could not load listened threads: ${formatErrorMessage(err)}`);
    }
  }

  private async saveListenedThreads(): Promise<void> {
    try {
      const data = Array.from(this.listenedThreadIds).filter((id) => id !== 'thread-123');
      if (this.threadConfigService) {
        for (const id of data) {
          await this.threadConfigService.setListened(id, true);
        }
      }
      const dir = path.dirname(this.whitelistFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await fs.promises.writeFile(this.whitelistFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err: unknown) {
      this.logger.warn(`Could not save listened threads: ${formatErrorMessage(err)}`);
    }
  }

  private async initPlugins(api: API): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.init) {
        try {
          await plugin.init(this, api);
        } catch (err) {
          this.logger.error(
            `Error initializing plugin "${plugin.name}": ${formatErrorMessage(err)}`,
          );
        }
      }
    }
  }

  private async destroyPlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onDestroy) {
        try {
          await plugin.onDestroy();
        } catch (err) {
          this.logger.error(`Error destroying plugin "${plugin.name}": ${formatErrorMessage(err)}`);
        }
      }
    }
  }
}
