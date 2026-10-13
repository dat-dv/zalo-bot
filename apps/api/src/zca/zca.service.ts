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
import { ZaloService } from '../zalo/zalo.service';
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
} from './shapes';
import { HttpProxyAgent } from 'http-proxy-agent';
import nodefetch from 'node-fetch';
import { ZCA_DEFAULT_USER_AGENT, ZCA_MODULE_OPTIONS } from './zca.constants';
import type { ZcaModuleOptions, ZcaPlugin } from './zca.interfaces';
import { createSharpImageMetadataGetter } from './zca-metadata.util';
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

export interface AvailableThread {
  id: string;
  name: string;
  type: 'user' | 'group';
  isListened: boolean;
  avatar?: string;
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

  private readonly whitelistFilePath = path.resolve(process.cwd(), '.zca-listened-threads.json');

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(ZCA_MODULE_OPTIONS)
    private readonly moduleOptions?: ZcaModuleOptions,
    @Optional()
    groupEventDispatcher?: GroupEventDispatcher,
    @Optional()
    @Inject(forwardRef(() => ZaloService))
    private readonly zaloService?: ZaloService,
  ) {
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
      this.moduleOptions?.logging ?? this.configService.get<boolean>('zca.logging') ?? false;

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
      // @ts-expect-error polyfill node-fetch for proxy compatibility in Node.js
      polyfill: nodefetch,
      selfListen,
      checkUpdate,
      logging,
      imageMetadataGetter,
    });

    if (this.moduleOptions?.plugins?.length) {
      this.registerPlugins(this.moduleOptions.plugins);
    }
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
    return this.zaloService;
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

  /**
   * Log in to Zalo using session credentials (cookies, imei, userAgent).
   */
  public async login(credentials?: Partial<Credentials>): Promise<API> {
    const rawCookie =
      credentials?.cookie ??
      this.moduleOptions?.cookie ??
      this.configService.get<string>('zca.cookie') ??
      process.env.ZCA_COOKIE;

    const imei =
      credentials?.imei ??
      this.moduleOptions?.imei ??
      this.configService.get<string>('zca.imei') ??
      process.env.ZCA_IMEI;

    const userAgent =
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
    this.api = api;

    this.logger.log('Successfully logged in to Zalo via ZCA.');
    await this.initPlugins(api);
    this.startListener();

    return api;
  }

  /**
   * Starts a QR login flow with callbacks for generated QR URL, scan status, and success.
   */
  public async startQrLogin(callbacks?: {
    onQrGenerated?: (qrUrl: string, code: string) => void;
    onScanned?: (name: string) => void;
    onExpired?: () => void;
    onDeclined?: () => void;
    onSuccess?: (ownId: string) => void;
    onError?: (err: string) => void;
  }): Promise<API> {
    const appUrl =
      this.configService.get<string>('appUrl') || process.env.APP_URL || 'http://localhost:3005';
    const qrEndpointUrl = `${appUrl.replace(/\/+$/, '')}/api/zca/qr`;

    const userAgent =
      this.moduleOptions?.userAgent ??
      this.configService.get<string>('zca.userAgent') ??
      process.env.ZCA_USER_AGENT ??
      ZCA_DEFAULT_USER_AGENT;

    this.logger.log('Initiating ZCA QR code login flow...');

    try {
      const api = await this.client.loginQR({ userAgent }, (event: LoginQRCallbackEvent) => {
        switch (event.type) {
          case LoginQRCallbackEventType.QRCodeGenerated: {
            this.latestQrImageBase64 = event.data.image;
            this.latestQrCode = event.data.code;
            this.logger.log(`ZCA QR code generated. Endpoint URL: ${qrEndpointUrl}`);
            callbacks?.onQrGenerated?.(qrEndpointUrl, event.data.code);
            break;
          }
          case LoginQRCallbackEventType.QRCodeScanned: {
            this.logger.log(`ZCA QR code scanned by: ${event.data.display_name}`);
            callbacks?.onScanned?.(event.data.display_name);
            break;
          }
          case LoginQRCallbackEventType.QRCodeExpired: {
            this.logger.warn('ZCA QR code expired. Retrying generation...');
            callbacks?.onExpired?.();
            event.actions.retry();
            break;
          }
          case LoginQRCallbackEventType.QRCodeDeclined: {
            this.logger.warn('ZCA QR login was declined on mobile device.');
            callbacks?.onDeclined?.();
            break;
          }
          case LoginQRCallbackEventType.GotLoginInfo: {
            this.logger.log(`ZCA login credentials captured for IMEI: ${event.data.imei}`);
            break;
          }
        }
      });

      this.api = api;
      const ownId = typeof api.getOwnId === 'function' ? api.getOwnId() : 'unknown';
      this.logger.log(`ZCA login successful! Logged in as: ${ownId}`);
      callbacks?.onSuccess?.(ownId);

      await this.initPlugins(api);
      this.startListener();
      return api;
    } catch (err: unknown) {
      const errMsg = formatErrorMessage(err);
      this.logger.error(`ZCA QR login failed: ${errMsg}`);
      callbacks?.onError?.(errMsg);
      throw err;
    }
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

    this.api = api;
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
    this.logger.log(`Updated listened threads count: ${this.listenedThreadIds.size}`);
  }

  /**
   * Whitelist Management: Toggle single thread ID and persist.
   */
  public async toggleListenedThread(id: string): Promise<boolean> {
    const strId = String(id).trim();
    if (!strId) return false;
    let enabled = false;
    if (this.listenedThreadIds.has(strId)) {
      this.listenedThreadIds.delete(strId);
      enabled = false;
    } else {
      this.listenedThreadIds.add(strId);
      enabled = true;
    }
    await this.saveListenedThreads();
    this.logger.log(`Toggled listened thread ${strId}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return enabled;
  }

  /**
   * Returns all available groups & friends with isListened status.
   */
  public async getAvailableThreads(): Promise<AvailableThread[]> {
    const result: AvailableThread[] = [];
    const seenIds = new Set<string>();

    if (this.api) {
      try {
        const groups = await this.api.getAllGroups();
        if (groups && typeof groups === 'object') {
          const groupList = Array.isArray(groups) ? groups : Object.values(groups);
          for (const g of groupList as Record<string, unknown>[]) {
            const rawId = g.groupId ?? g.id;
            const groupId =
              typeof rawId === 'string' ? rawId : typeof rawId === 'number' ? String(rawId) : '';
            if (groupId && !seenIds.has(groupId)) {
              seenIds.add(groupId);
              const rawName = g.groupName ?? g.name;
              const groupName = typeof rawName === 'string' ? rawName : `Nhóm ${groupId}`;
              result.push({
                id: groupId,
                name: groupName,
                type: 'group',
                isListened: this.listenedThreadIds.has(groupId),
                avatar:
                  typeof g.avt === 'string'
                    ? g.avt
                    : typeof g.avatar === 'string'
                      ? g.avatar
                      : undefined,
              });
            }
          }
        }
      } catch (err: unknown) {
        this.logger.warn(`Failed to fetch groups from ZCA: ${formatErrorMessage(err)}`);
      }

      try {
        const friends = await this.api.getAllFriends();
        if (friends && typeof friends === 'object') {
          const friendList = Array.isArray(friends) ? friends : Object.values(friends);
          for (const f of friendList as Record<string, unknown>[]) {
            const rawId = f.userId ?? f.id;
            const userId =
              typeof rawId === 'string' ? rawId : typeof rawId === 'number' ? String(rawId) : '';
            if (userId && !seenIds.has(userId)) {
              seenIds.add(userId);
              const rawName = f.displayName ?? f.dName ?? f.name;
              const userName = typeof rawName === 'string' ? rawName : `Người dùng ${userId}`;
              result.push({
                id: userId,
                name: userName,
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
        }
      } catch (err: unknown) {
        this.logger.warn(`Failed to fetch friends from ZCA: ${formatErrorMessage(err)}`);
      }
    }

    // Always include any saved thread IDs that are in the whitelist
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

    return result;
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
      if (this.listenedThreadIds.size > 0 && !this.listenedThreadIds.has(message.threadId)) {
        this.logger.debug(`Message from thread ${message.threadId} ignored (not in listened list)`);
        return;
      }
      this.logger.log(
        `[ZCA Message] threadId: ${message.threadId}, type: ${message.type}, isSelf: ${message.isSelf}`,
      );
      void this.dispatchMessage(message);
    });

    // 2. Reaction listener
    listener.on('reaction', (reaction: Reaction) => {
      void this.dispatchReaction(reaction);
    });

    // 3. Group event listener (e.g. member joins -> Welcome strategy)
    listener.on('group_event', (event: GroupEvent) => {
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
    return this.api.sendMessage(message, threadId, type);
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
    return this.api.undo(payload, threadId, type);
  }

  /**
   * Dispatch message to all registered plugins.
   */
  public async dispatchMessage(message: Message): Promise<void> {
    if (!this.api) return;

    for (const plugin of this.plugins) {
      if (plugin.onMessage) {
        try {
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
      if (fs.existsSync(this.whitelistFilePath)) {
        const content = await fs.promises.readFile(this.whitelistFilePath, 'utf8');
        const parsed = JSON.parse(content) as string[];
        if (Array.isArray(parsed)) {
          this.listenedThreadIds = new Set(parsed.map(String).filter(Boolean));
          this.logger.log(`Loaded ${this.listenedThreadIds.size} listened threads from disk.`);
        }
      }
    } catch (err: unknown) {
      this.logger.warn(`Could not load listened threads: ${formatErrorMessage(err)}`);
    }
  }

  private async saveListenedThreads(): Promise<void> {
    try {
      const data = Array.from(this.listenedThreadIds);
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
