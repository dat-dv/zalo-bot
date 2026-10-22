import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { IDashboardAccessCodeRequest } from '@zalobot/contracts';

export class DashboardAccessCodeDto implements IDashboardAccessCodeRequest {
  @ApiProperty({ description: 'Sign-in code from the bot reply, e.g. K7P2-QX9M' })
  @IsString()
  @IsNotEmpty()
  // 8 symbols plus room for a dash and stray spaces; the exact format is checked when hashing.
  @MaxLength(16)
  code!: string;
}
