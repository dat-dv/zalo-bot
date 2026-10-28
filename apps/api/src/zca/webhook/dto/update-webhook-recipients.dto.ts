import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { IUpdateWebhookRecipientsRequest, IWebhookRecipient } from '@zalobot/contracts';
import { WEBHOOK_TARGET_ID_MAX_LENGTH } from './webhook-send-message.dto';

/** One call messages every recipient in turn, so the list stays short. */
export const WEBHOOK_RECIPIENTS_MAX = 50;

export class WebhookRecipientDto implements IWebhookRecipient {
  @ApiProperty({ description: 'ID người dùng hoặc nhóm Zalo', example: '123456789012345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(WEBHOOK_TARGET_ID_MAX_LENGTH)
  threadId!: string;

  @ApiPropertyOptional({ description: 'Tên hiển thị lúc chọn', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  threadName!: string | null;

  @ApiProperty({ enum: ['user', 'group'] })
  @IsIn(['user', 'group'])
  threadType!: 'user' | 'group';
}

export class UpdateWebhookRecipientsDto implements IUpdateWebhookRecipientsRequest {
  @ApiProperty({ type: [WebhookRecipientDto] })
  @IsArray()
  @ArrayMaxSize(WEBHOOK_RECIPIENTS_MAX, {
    message: `Chọn tối đa ${WEBHOOK_RECIPIENTS_MAX} người nhận`,
  })
  @ValidateNested({ each: true })
  @Type(() => WebhookRecipientDto)
  recipients!: WebhookRecipientDto[];
}
