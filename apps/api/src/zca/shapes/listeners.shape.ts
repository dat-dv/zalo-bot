/**
 * ZCA Listeners Shape definitions
 * Reference: https://zca-js.tdung.com/vi/listeners/
 * Covers all event listener shapes:
 * - message (UserMessage | GroupMessage)
 * - reaction (Reaction)
 * - undo (Undo)
 * - group_event (GroupEvent)
 * - friend_event (FriendEvent)
 * - typing (Typing)
 * - seen_messages (SeenMessage[])
 * - delivered_messages (DeliveredMessage[])
 * - lifecycle: connected, disconnected, closed, error
 */

import type {
  API,
  CloseReason,
  Message,
  Reaction,
  Undo,
  GroupEvent,
  FriendEvent,
  Typing,
  SeenMessage,
  DeliveredMessage,
  ThreadType,
} from 'zca-js';

export type { CloseReason } from 'zca-js';

export type ZcaListener = API['listener'];

export interface UploadEventData {
  fileUrl: string;
  fileId: string;
}

export interface WsPayload<T = Record<string, unknown>> {
  version: number;
  cmd: number;
  subCmd: number;
  data: T;
}

export type OnConnectedCallback = () => void | Promise<void>;
export type OnDisconnectedCallback = (code: CloseReason, reason: string) => void | Promise<void>;
export type OnClosedCallback = (code: CloseReason, reason: string) => void | Promise<void>;
export type OnErrorCallback = (error: unknown) => void | Promise<void>;

export type OnMessageCallback = (message: Message, api: API) => void | Promise<void>;
export type OnReactionCallback = (reaction: Reaction, api: API) => void | Promise<void>;
export type OnGroupEventCallback = (event: GroupEvent, api: API) => void | Promise<void>;
export type OnFriendEventCallback = (event: FriendEvent, api: API) => void | Promise<void>;
export type OnUndoCallback = (undo: Undo, api: API) => void | Promise<void>;
export type OnTypingCallback = (typing: Typing, api: API) => void | Promise<void>;
export type OnSeenMessagesCallback = (messages: SeenMessage[], api: API) => void | Promise<void>;
export type OnDeliveredMessagesCallback = (
  messages: DeliveredMessage[],
  api: API,
) => void | Promise<void>;
export type OnUploadAttachmentCallback = (data: UploadEventData, api: API) => void | Promise<void>;

/**
 * Event map describing all possible realtime events dispatched by zca-js listener.
 */
export interface ZcaListenerEventsMap {
  connected: [];
  disconnected: [code: CloseReason, reason: string];
  closed: [code: CloseReason, reason: string];
  error: [error: unknown];
  typing: [typing: Typing];
  message: [message: Message];
  old_messages: [messages: Message[], type: ThreadType];
  seen_messages: [messages: SeenMessage[]];
  delivered_messages: [messages: DeliveredMessage[]];
  reaction: [reaction: Reaction];
  old_reactions: [reactions: Reaction[], isGroup: boolean];
  upload_attachment: [data: UploadEventData];
  undo: [data: Undo];
  friend_event: [data: FriendEvent];
  group_event: [data: GroupEvent];
  cipher_key: [key: string];
}
