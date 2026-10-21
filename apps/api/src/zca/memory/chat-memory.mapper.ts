/**
 * Pure mapping between ZCA message payloads and chat-memory rows, plus the prompt line format.
 * Kept free of `zca-bot-feature.service` imports so the memory service has no import cycle with it.
 */

/** The `data` fields of a zca-js message (live listener or the Redis recent-message buffer). */
export interface MemorySourceMessage {
  msgId?: unknown;
  cliMsgId?: unknown;
  msgType?: unknown;
  ts?: unknown;
  content?: unknown;
  uidFrom?: unknown;
  dName?: unknown;
  quote?: unknown;
}

export type MemoryChannelType = 'user' | 'group';

export interface ChatMemoryRecord {
  channelId: string;
  channelType: MemoryChannelType;
  msgId: string;
  cliMsgId: string | null;
  senderUid: string;
  senderName: string | null;
  isBot: boolean;
  msgType: string;
  text: string | null;
  content: Record<string, unknown> | null;
  quoteMsgId: string | null;
  sentAt: Date;
}

/** One remembered message as shown to the LLM. */
export interface MemoryLine {
  sentAt: Date;
  senderName: string | null;
  isBot: boolean;
  text: string;
}

const MEDIA_LABELS: Record<string, string> = {
  'chat.photo': 'Ảnh',
  'chat.video.msg': 'Video',
  'chat.voice': 'Ghi âm',
  'chat.sticker': 'Sticker',
  'chat.gif': 'GIF',
  'chat.location.new': 'Vị trí',
  'chat.recommended': 'Liên kết',
  'chat.link': 'Liên kết',
};

/** Attachment keys worth remembering; URLs are dropped because Zalo CDN links expire. */
const KEPT_CONTENT_KEYS = ['title', 'description', 'text', 'fileName', 'name'] as const;

/** Hard cap per stored message, so one pasted document cannot dominate a prompt. */
export const MEMORY_TEXT_MAX_CHARS = 2000;

function asTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function parseObjectContent(content: unknown): Record<string, unknown> | null {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content as Record<string, unknown>;
  }
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Plain text that merely starts with "{".
    }
  }
  return null;
}

function pickKeptContent(obj: Record<string, unknown>): Record<string, unknown> | null {
  const kept: Record<string, unknown> = {};
  for (const key of KEPT_CONTENT_KEYS) {
    const value = asTrimmedString(obj[key]);
    if (value) kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : null;
}

/** Searchable text: the message itself, or a media label plus caption / file name. */
export function buildMemoryText(msgType: string, content: unknown): string {
  const obj = parseObjectContent(content);
  if (!obj) {
    return typeof content === 'string' ? content.trim() : '';
  }

  const caption =
    asTrimmedString(obj.title) || asTrimmedString(obj.description) || asTrimmedString(obj.text);
  if (msgType === 'share.file' || msgType === 'sharefile') {
    const fileName = asTrimmedString(obj.fileName) || asTrimmedString(obj.name) || caption;
    return fileName ? `[File: ${fileName}]` : '[File]';
  }

  const label = MEDIA_LABELS[msgType];
  if (label) return caption ? `[${label}] ${caption}` : `[${label}]`;
  return caption;
}

export function toSentAt(ts: unknown, fallback: Date = new Date()): Date {
  const millis = typeof ts === 'number' ? ts : Number(asTrimmedString(ts));
  return Number.isFinite(millis) && millis > 0 ? new Date(millis) : fallback;
}

function readQuoteMsgId(quote: unknown): string | null {
  if (!quote || typeof quote !== 'object') return null;
  const id = asTrimmedString((quote as Record<string, unknown>).globalMsgId);
  return id || null;
}

/** `null` when the payload has no message id (cannot be deduplicated, so it is not stored). */
export function toMemoryRecord(
  channelId: string,
  channelType: MemoryChannelType,
  data: MemorySourceMessage,
  options: { isBot?: boolean; now?: Date } = {},
): ChatMemoryRecord | null {
  const msgId = asTrimmedString(data.msgId) || asTrimmedString(data.cliMsgId);
  if (!channelId || !msgId) return null;

  const msgType = asTrimmedString(data.msgType) || 'webchat';
  const text = buildMemoryText(msgType, data.content).slice(0, MEMORY_TEXT_MAX_CHARS);
  const obj = parseObjectContent(data.content);

  return {
    channelId,
    channelType,
    msgId,
    cliMsgId: asTrimmedString(data.cliMsgId) || null,
    senderUid: asTrimmedString(data.uidFrom),
    senderName: asTrimmedString(data.dName) || null,
    isBot: options.isBot ?? false,
    msgType,
    text: text || null,
    content: obj ? pickKeptContent(obj) : null,
    quoteMsgId: readQuoteMsgId(data.quote),
    sentAt: toSentAt(data.ts, options.now),
  };
}

/** `[2025-07-12 19:03] Đạt: …` in the given IANA time zone. */
export function formatMemoryLine(line: MemoryLine, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(line.sentAt);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const stamp = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  const speaker = line.isBot ? 'Bot' : line.senderName || 'Ai đó';
  return `[${stamp}] ${speaker}: ${line.text}`;
}
