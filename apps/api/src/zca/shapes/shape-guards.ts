/**
 * ZCA Shape Guards and Utility Transformers
 * Provides helper functions, type narrowing guards, and builders for ZCA models and APIs.
 */

import { ThreadType, type Urgency } from './enums.shape';
import {
  UserMessage,
  GroupMessage,
  Reaction,
  Undo,
  type Message,
  type GroupEvent,
  type FriendEvent,
  type TAttachmentContent,
  type GroupEventUpdateMember,
  type NormalizedGroupMember,
} from './models.shape';
import type { MessageContent, Mention, Style, SendMessageQuote } from './apis.shape';
import type { AttachmentSource } from './models.shape';

/**
 * Type guard for User (direct 1-on-1) Message.
 */
export function isUserMessage(msg: Message): msg is UserMessage {
  return msg.type === ThreadType.User;
}

/**
 * Type guard for Group Message.
 */
export function isGroupMessage(msg: Message): msg is GroupMessage {
  return msg.type === ThreadType.Group;
}

/**
 * Checks whether the message payload contains plain text content.
 */
export function isTextMessage(msg: Message): boolean {
  return typeof msg.data?.content === 'string';
}

/**
 * Safely extracts text content from any message (string or attachment title/desc).
 */
export function getMessageText(msg: Message): string {
  if (!msg.data) return '';
  const content = msg.data.content;
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object') {
    const attachment = content as TAttachmentContent;
    return attachment.title || attachment.description || '';
  }
  return '';
}

/**
 * Extracts sender UID from a message.
 */
export function getMessageSenderId(msg: Message): string {
  return msg.data?.uidFrom || '';
}

/**
 * Extracts thread ID (user ID or group ID) from a message.
 */
export function getMessageThreadId(msg: Message): string {
  return msg.threadId;
}

/**
 * Checks if the message was sent by the authenticated bot itself.
 */
export function isSelfMessage(msg: Message): boolean {
  return Boolean(msg.isSelf);
}

/**
 * Checks if a specific user was mentioned in the message.
 */
export function isMentioned(msg: Message, userId: string): boolean {
  if (!isGroupMessage(msg)) return false;
  const mentions = msg.data.mentions;
  if (!Array.isArray(mentions)) return false;
  return mentions.some((m) => m.uid === userId);
}

/**
 * Normalizes member information across different ZCA event shapes.
 */
export function normalizeGroupMember(
  member: string | GroupEventUpdateMember,
): NormalizedGroupMember {
  if (typeof member === 'string') {
    return {
      id: member,
      dName: 'bạn mới',
    };
  }
  return {
    id: member.id,
    dName: member.dName || 'bạn mới',
    avatar: member.avatar,
  };
}

/**
 * Extracts and normalizes members updated in a group event.
 */
export function getGroupUpdateMembers(event: GroupEvent): NormalizedGroupMember[] {
  if (!event || !event.data || !('updateMembers' in event.data)) {
    return [];
  }
  const rawMembers = (event.data as { updateMembers?: (string | GroupEventUpdateMember)[] })
    .updateMembers;
  if (!Array.isArray(rawMembers)) {
    return [];
  }
  return rawMembers.map(normalizeGroupMember);
}

/**
 * Type guard for Reaction event.
 */
export function isReaction(event: unknown): event is Reaction {
  return (
    event instanceof Reaction ||
    (typeof event === 'object' &&
      event !== null &&
      'data' in event &&
      'reaction' in (event as Record<string, unknown>))
  );
}

/**
 * Type guard for Undo event.
 */
export function isUndo(event: unknown): event is Undo {
  return (
    event instanceof Undo ||
    (typeof event === 'object' &&
      event !== null &&
      'data' in event &&
      'msgId' in (event as Record<string, unknown>))
  );
}

/**
 * Type guard for GroupEvent.
 */
export function isGroupEvent(event: unknown): event is GroupEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'threadId' in event &&
    'type' in event &&
    'act' in event
  );
}

/**
 * Type guard for FriendEvent.
 */
export function isFriendEvent(event: unknown): event is FriendEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'threadId' in event &&
    'type' in event &&
    !('act' in event)
  );
}

/**
 * Builds SendMessageQuote from an incoming Message for replying with a quote.
 */
export function buildQuoteFromMessage(message: Message): SendMessageQuote {
  const d = message.data;
  return {
    content: d.content,
    msgType: d.msgType,
    propertyExt: d.propertyExt,
    uidFrom: d.uidFrom,
    msgId: d.msgId,
    cliMsgId: d.cliMsgId,
    ts: d.ts,
    ttl: d.ttl,
  };
}

/**
 * Creates a mention object at a specific position.
 */
export function buildMention(uid: string, displayName: string, pos = 0): Mention {
  const mentionText = `@${displayName}`;
  return {
    pos,
    uid,
    len: mentionText.length,
  };
}

/**
 * Helper to construct a typed MessageContent payload.
 */
export function buildMessageContent(
  text: string,
  options?: {
    mentions?: Mention[];
    urgency?: Urgency;
    styles?: Style[];
    attachments?: AttachmentSource | AttachmentSource[];
    quote?: SendMessageQuote;
    ttl?: number;
  },
): MessageContent {
  return {
    msg: text,
    mentions: options?.mentions,
    urgency: options?.urgency,
    styles: options?.styles,
    attachments: options?.attachments,
    quote: options?.quote,
    ttl: options?.ttl,
  };
}
