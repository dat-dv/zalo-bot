import type { API } from 'zca-js';
import type { ZcaService } from './zca.service';
import type {
  Message,
  Reaction,
  GroupEvent,
  FriendEvent,
  Undo,
  Typing,
  SeenMessage,
  DeliveredMessage,
  Credentials,
  ImageMetadataGetter,
  CloseReason,
} from './shapes';

export interface ZcaPlugin {
  name: string;
  description?: string;
  init?(service: ZcaService, api: API): Promise<void> | void;
  onConnected?(api: API): Promise<void> | void;
  onClosed?(code: CloseReason, reason: string): Promise<void> | void;
  onError?(error: unknown): Promise<void> | void;
  onMessage?(message: Message, api: API): Promise<void> | void;
  onReaction?(reaction: Reaction, api: API): Promise<void> | void;
  onGroupEvent?(event: GroupEvent, api: API): Promise<void> | void;
  onFriendEvent?(event: FriendEvent, api: API): Promise<void> | void;
  onUndo?(undo: Undo, api: API): Promise<void> | void;
  onTyping?(typing: Typing, api: API): Promise<void> | void;
  onSeenMessages?(messages: SeenMessage[], api: API): Promise<void> | void;
  onDeliveredMessages?(messages: DeliveredMessage[], api: API): Promise<void> | void;
  onDestroy?(): Promise<void> | void;
}

export interface ZcaModuleOptions {
  proxyUrl?: string;
  imei?: string;
  cookie?: Credentials['cookie'] | string;
  userAgent?: string;
  language?: string;
  selfListen?: boolean;
  checkUpdate?: boolean;
  logging?: boolean;
  autoLogin?: boolean;
  enableSharpMetadata?: boolean;
  imageMetadataGetter?: ImageMetadataGetter;
  plugins?: ZcaPlugin[];
}
