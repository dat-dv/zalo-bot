import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { IWebhookSendMessageRequest } from '@zalobot/contracts';

/** About three Zalo messages; longer texts would turn one call into a burst of messages. */
export const WEBHOOK_MESSAGE_MAX_LENGTH = 5000;
export const WEBHOOK_TARGET_ID_MAX_LENGTH = 64;

/** At least one character that is not whitespace. */
const HAS_VISIBLE_TEXT = /\S/;

export class WebhookSendMessageDto implements IWebhookSendMessageRequest {
  @ApiProperty({
    description: 'ID người nhận hoặc ID nhóm trên Zalo (chatId / threadId)',
    example: '123456789012345678',
  })
  @IsNotEmpty({ message: 'targetId không được để trống' })
  @IsString({ message: 'targetId phải là chuỗi' })
  @Matches(HAS_VISIBLE_TEXT, { message: 'targetId không được để trống' })
  @MaxLength(WEBHOOK_TARGET_ID_MAX_LENGTH, {
    message: `targetId dài tối đa ${WEBHOOK_TARGET_ID_MAX_LENGTH} ký tự`,
  })
  targetId!: string;

  @ApiProperty({
    description: 'Nội dung tin nhắn cần gửi đến người nhận',
    example: 'Xin chào, đây là tin nhắn tự động từ webhook!',
    maxLength: WEBHOOK_MESSAGE_MAX_LENGTH,
  })
  @IsNotEmpty({ message: 'message không được để trống' })
  @IsString({ message: 'message phải là chuỗi' })
  @Matches(HAS_VISIBLE_TEXT, { message: 'message không được chỉ có khoảng trắng' })
  @MaxLength(WEBHOOK_MESSAGE_MAX_LENGTH, {
    message: `message dài tối đa ${WEBHOOK_MESSAGE_MAX_LENGTH} ký tự`,
  })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Loại hội thoại: "user" (chat riêng) hoặc "group" (nhóm). Tự động nhận diện nếu bỏ trống.',
    enum: ['user', 'group'],
  })
  @IsOptional()
  @IsIn(['user', 'group'], { message: 'threadType phải là "user" hoặc "group"' })
  threadType?: 'user' | 'group';
}
