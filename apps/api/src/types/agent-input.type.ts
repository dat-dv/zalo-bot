export type AgentInputType =
  'text' | 'image' | 'video' | 'voice' | 'sticker' | 'event' | 'unsupported';

export interface AgentInput {
  type: AgentInputType;
  senderId: string;
  chatId: string;
  displayName: string;
  text?: string;
  imageUrl?: string;
  /** Tất cả ảnh khi user gửi nhiều ảnh (multi-image). Phần tử đầu tiên trùng với imageUrl. */
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  voiceUrl?: string;
  stickerUrl?: string;
  caption?: string;
  eventName?: string;
  isBot?: boolean;
  raw?: unknown;
  /** Tool call arguments từ LLM (dùng cho strategies) */
  toolArgs?: Record<string, unknown>;
  /** Cho phép AI trò chuyện tự do (Chit-chat). Mặc định là true nếu không đặt. */
  allowAiChat?: boolean;
  /** Tiền tố gọi bot của kênh (ví dụ: "!", "bot:") để cắt khỏi tin trước khi đưa vào LLM */
  triggerPrefixes?: readonly string[];
  /** Id của tin đang xử lý (ZCA), để cửa sổ ngữ cảnh chat không lặp lại chính tin này */
  messageId?: string;
  /** Trí nhớ ngắn hạn của kênh (các tin gần nhất đưa vào prompt); chỉ có khi kênh bật `chatMemory.shortTermEnabled` */
  shortTermMemory?: { contextWindow: number };
  /** Trí nhớ dài hạn của kênh (tra lại chuyện cũ); chỉ có khi kênh bật `chatMemory.enabled` */
  longTermMemory?: { searchLimit: number };
}
