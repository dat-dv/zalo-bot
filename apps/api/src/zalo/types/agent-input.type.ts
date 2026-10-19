import type { TextToolType } from '../text/text-tool.enum';

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
  /** Khi ở chế độ thụ động trong nhóm (không gọi @bot/prefix trực tiếp): chỉ xử lý tool call, tuyệt đối không phản hồi chit-chat */
  passiveOnly?: boolean;
  /** Chỉ dùng khi `passiveOnly`: danh sách tool LLM được phép gọi. Rỗng/không đặt → không gọi LLM. */
  allowedTools?: readonly TextToolType[];
  /** Cho phép AI trò chuyện tự do (Chit-chat). Mặc định là true nếu không đặt. */
  allowAiChat?: boolean;
  /** Tiền tố gọi bot tùy chọn (ví dụ: "!", "/") để hỗ trợ cắt tỉa tiền tố trước khi đưa vào LLM */
  triggerPrefix?: string;
}
