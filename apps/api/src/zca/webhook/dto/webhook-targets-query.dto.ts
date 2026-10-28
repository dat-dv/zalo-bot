import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { IWebhookTargetsQuery } from '@zalobot/contracts';

export const WEBHOOK_TARGETS_QUERY_MAX_LENGTH = 100;

export class WebhookTargetsQueryDto implements IWebhookTargetsQuery {
  @ApiPropertyOptional({
    description: 'Chỉ lấy chat riêng ("user") hoặc nhóm ("group").',
    enum: ['user', 'group'],
  })
  @IsOptional()
  @IsIn(['user', 'group'], { message: 'type phải là "user" hoặc "group"' })
  type?: 'user' | 'group';

  @ApiPropertyOptional({
    description: 'Tìm theo tên, không phân biệt hoa thường và dấu.',
    example: 'ke toan',
  })
  @IsOptional()
  @IsString({ message: 'q phải là chuỗi' })
  @MaxLength(WEBHOOK_TARGETS_QUERY_MAX_LENGTH, {
    message: `q dài tối đa ${WEBHOOK_TARGETS_QUERY_MAX_LENGTH} ký tự`,
  })
  q?: string;
}
