export type AgentInputType = 'text' | 'image' | 'voice' | 'sticker' | 'event' | 'unsupported';

export interface AgentInput {
  type: AgentInputType;
  senderId: string;
  chatId: string;
  displayName: string;
  text?: string;
  imageUrl?: string;
  /** Tất cả ảnh khi user gửi nhiều ảnh (multi-image). Phần tử đầu tiên trùng với imageUrl. */
  imageUrls?: string[];
  voiceUrl?: string;
  stickerUrl?: string;
  caption?: string;
  eventName?: string;
  isBot?: boolean;
  raw?: unknown;
  /** Tool call arguments từ LLM (dùng cho strategies) */
  toolArgs?: Record<string, unknown>;
}
