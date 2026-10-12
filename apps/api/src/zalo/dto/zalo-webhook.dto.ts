import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Các loại sự kiện từ Zalo Bot Platform theo tài liệu chính thức
 */
export enum ZaloWebhookEventName {
  MESSAGE_TEXT_RECEIVED = 'message.text.received',
  MESSAGE_IMAGE_RECEIVED = 'message.image.received',
  MESSAGE_STICKER_RECEIVED = 'message.sticker.received',
  MESSAGE_VOICE_RECEIVED = 'message.voice.received',
  MESSAGE_UNSUPPORTED_RECEIVED = 'message.unsupported.received',
  // Tương thích ngược với Zalo Official Account v3 OA (nếu có)
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',
  USER_SEND_TEXT = 'user_send_text',
  USER_SEND_IMAGE = 'user_send_image',
}

/**
 * Thông tin cuộc trò chuyện (Chat)
 */
export class ZaloChatDto {
  @ApiProperty({
    description: 'ID cuộc trò chuyện (Chat ID / User ID)',
    example: 'effcda102859c1079848',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Loại cuộc trò chuyện: PRIVATE (cá nhân) hoặc GROUP (nhóm)',
    example: 'PRIVATE',
    enum: ['PRIVATE', 'GROUP'],
  })
  chat_type?: 'PRIVATE' | 'GROUP';
}

/**
 * Thông tin người gửi tin nhắn (From)
 */
export class ZaloFromDto {
  @ApiProperty({
    description: 'ID người gửi tin nhắn',
    example: 'effcda102859c1079848',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Tên hiển thị của người gửi',
    example: 'Văn Đạt',
  })
  display_name?: string;

  @ApiPropertyOptional({
    description: 'Có phải bot hay không',
    example: false,
  })
  is_bot?: boolean;
}

/**
 * Chi tiết tin nhắn gửi tới Zalo Bot
 */
export class ZaloMessageDto {
  @ApiProperty({
    description: 'ID duy nhất của tin nhắn',
    example: '1b0890ddc3cabd93e4dc',
  })
  message_id: string;

  @ApiProperty({
    description: 'Thời gian gửi tin nhắn (Unix timestamp in milliseconds)',
    example: 1791346364971,
  })
  date: number;

  @ApiProperty({
    description: 'Thông tin người gửi',
    type: () => ZaloFromDto,
  })
  from: ZaloFromDto;

  @ApiProperty({
    description: 'Thông tin cuộc trò chuyện',
    type: () => ZaloChatDto,
  })
  chat: ZaloChatDto;

  @ApiPropertyOptional({
    description: 'Loại tin nhắn (VD: CHAT_PHOTO, ...)',
    example: 'CHAT_PHOTO',
  })
  message_type?: string;

  @ApiPropertyOptional({
    description: 'Nội dung tin nhắn văn bản (cho message.text.received)',
    example: 'hello this is',
  })
  text?: string;

  @ApiPropertyOptional({
    description: 'URL ảnh (theo payload thực tế Zalo Bot gửi)',
    example:
      'https://photo-stal-13.zdn.vn/no/jpg/040038402864f93aa075/2aOboR3n9WpBNOQxgdAXjZ0qJFsMgZsjIAeeMlay.jpg',
  })
  photo_url?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh (theo tài liệu đặc tả Zalo)',
    example: 'https://photo.zalo.me/...',
  })
  photo?: string;

  @ApiPropertyOptional({
    description: 'Văn bản chú thích gửi kèm hình ảnh',
    example: '',
  })
  caption?: string;

  @ApiPropertyOptional({
    description: 'ID hoặc nguồn sticker',
    example: 'sticker_id_123',
  })
  sticker?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh/file sticker',
    example: 'https://stickers.zaloapp.com/...',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn tệp âm thanh của tin nhắn thoại (voice)',
    example: 'https://voice.zalo.me/...',
  })
  voice_url?: string;

  @ApiPropertyOptional({
    description:
      'Danh sách ảnh đính kèm (khi gửi nhiều ảnh hoặc multi-image trong nhóm). ' +
      'Mỗi phần tử có thể có các field: photo_url, photo, caption, thumb, ...',
    example: [{ photo_url: 'https://photo.zalo.me/...', caption: '' }],
    isArray: true,
  })
  attachments?: Array<{
    photo_url?: string;
    photo?: string;
    caption?: string;
    thumb?: string;
    url?: string;
    [key: string]: unknown;
  }>;

  @ApiPropertyOptional({
    description: 'Danh sách media (định dạng thay thế của attachments trong một số version Zalo)',
    isArray: true,
  })
  medias?: Array<{
    photo_url?: string;
    photo?: string;
    caption?: string;
    url?: string;
    [key: string]: unknown;
  }>;

  @ApiPropertyOptional({
    description: 'Thumbnail URL ảnh (dùng với một số loại tin nhắn hình ảnh)',
    example: 'https://photo.zalo.me/...',
  })
  thumb?: string;

  @ApiPropertyOptional({
    description: 'Message quota hoặc quota info (metadata từ Zalo)',
  })
  quota?: unknown;

  @ApiPropertyOptional({
    description: 'Message ID hash hoặc tham chiếu tin nhắn',
    example: 'abc123hash',
  })
  mid_hash?: string;

  [key: string]: unknown;
}

/**
 * Khối dữ liệu sự kiện khi bọc trong `result`
 */
export class ZaloWebhookResultDto {
  @ApiPropertyOptional({
    description: 'Tên sự kiện',
    enum: ZaloWebhookEventName,
    example: ZaloWebhookEventName.MESSAGE_TEXT_RECEIVED,
  })
  event_name?: ZaloWebhookEventName | string;

  @ApiPropertyOptional({
    description: 'Dữ liệu tin nhắn',
    type: () => ZaloMessageDto,
  })
  message?: ZaloMessageDto;
}

/**
 * Payload Webhook chính nhận từ Zalo Bot
 * Hỗ trợ cả 2 dạng: gửi trực tiếp hoặc bọc trong { ok: true, result: ... }
 */
export class ZaloWebhookPayloadDto {
  @ApiPropertyOptional({
    description: 'Tên sự kiện (dạng gửi trực tiếp tại root)',
    enum: ZaloWebhookEventName,
    example: ZaloWebhookEventName.MESSAGE_TEXT_RECEIVED,
  })
  event_name?: ZaloWebhookEventName | string;

  @ApiPropertyOptional({
    description: 'Dữ liệu tin nhắn (dạng gửi trực tiếp tại root)',
    type: () => ZaloMessageDto,
  })
  message?: ZaloMessageDto;

  @ApiPropertyOptional({
    description: 'Cờ trạng thái nếu Zalo gửi dạng bọc wrapper',
    example: true,
  })
  ok?: boolean;

  @ApiPropertyOptional({
    description: 'Dữ liệu sự kiện nếu được bọc trong field result',
    type: () => ZaloWebhookResultDto,
  })
  result?: ZaloWebhookResultDto;

  // Khả năng tương thích ngược
  @ApiPropertyOptional({ description: 'ID ứng dụng Zalo (legacy)' })
  app_id?: string;

  @ApiPropertyOptional({ description: 'User ID phân bổ theo app (legacy)' })
  user_id_by_app?: string;

  @ApiPropertyOptional({ description: 'Timestamp sự kiện (legacy)' })
  timestamp?: string | number;

  @ApiPropertyOptional({ description: 'Người gửi (legacy OA)' })
  sender?: { id?: string | number; [key: string]: unknown };

  @ApiPropertyOptional({ description: 'Người nhận (legacy OA)' })
  recipient?: { id?: string | number; [key: string]: unknown };

  [key: string]: unknown;
}

/**
 * Alias tương thích ngược cho interface cũ
 */
export type ZaloWebhookPayload = ZaloWebhookPayloadDto;
export type ZaloChat = ZaloChatDto;
export type ZaloFrom = ZaloFromDto;
export type ZaloMessagePayload = ZaloMessageDto;

/**
 * Dữ liệu sự kiện đã chuẩn hoá giúp code xử lý đơn giản, an toàn
 */
export interface NormalizedZaloEvent {
  eventName: ZaloWebhookEventName | string;
  message?: ZaloMessageDto;
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
  isBot: boolean;
  isUnsupported: boolean;
  rawPayload: ZaloWebhookPayloadDto;
}

/**
 * Helper chuẩn hoá payload Webhook: Tự động trích xuất đúng data bất kể Zalo gửi dạng trực tiếp hay bọc trong result
 */
export function normalizeZaloWebhookPayload(payload: ZaloWebhookPayloadDto): NormalizedZaloEvent {
  const eventName = payload.event_name ?? payload.result?.event_name ?? '';
  const message = payload.message ?? payload.result?.message;

  const senderId = String(
    message?.from?.id ?? message?.chat?.id ?? payload.sender?.id ?? payload.user_id_by_app ?? '',
  ).trim();

  const chatId = String(message?.chat?.id ?? message?.from?.id ?? senderId).trim();

  const displayName = message?.from?.display_name || 'bạn';
  const text = message?.text?.trim();
  const voiceUrl = message?.voice_url;
  const stickerUrl = message?.url || message?.sticker;
  const caption = message?.caption;
  const isBot = Boolean(message?.from?.is_bot);
  const isUnsupported = eventName === (ZaloWebhookEventName.MESSAGE_UNSUPPORTED_RECEIVED as string);

  // Trích xuất tất cả URL ảnh — hỗ trợ single image, attachments[] và medias[]
  const imageUrls: string[] = [];

  // Single image trực tiếp
  const directImageUrl = message?.photo_url || message?.photo || message?.thumb;
  if (directImageUrl) {
    imageUrls.push(directImageUrl);
  }

  // Multi-image qua attachments[]
  if (Array.isArray(message?.attachments)) {
    for (const att of message.attachments) {
      const url = att.photo_url || att.photo || att.url;
      if (url && !imageUrls.includes(url)) {
        imageUrls.push(url);
      }
    }
  }

  // Multi-image qua medias[]
  if (Array.isArray(message?.medias)) {
    for (const media of message.medias) {
      const url = media.photo_url || media.photo || media.url;
      if (url && !imageUrls.includes(url)) {
        imageUrls.push(url);
      }
    }
  }

  const imageUrl = imageUrls[0]; // URL ảnh đầu tiên (tương thích ngược)

  return {
    eventName,
    message,
    senderId,
    chatId,
    displayName,
    text,
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    voiceUrl,
    stickerUrl,
    caption,
    isBot,
    isUnsupported,
    rawPayload: payload,
  };
}
