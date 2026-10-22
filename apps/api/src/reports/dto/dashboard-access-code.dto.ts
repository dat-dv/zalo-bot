import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  DASHBOARD_ACCESS_CODE_MAX_LENGTH,
  type IDashboardAccessCodeRequest,
} from '@zalobot/contracts';

export class DashboardAccessCodeDto implements IDashboardAccessCodeRequest {
  @ApiProperty({ description: 'Sign-in code from the bot reply, e.g. 1234-5678' })
  @IsString()
  @IsNotEmpty()
  // Digits only, any length; the exact format is checked when hashing.
  @MaxLength(DASHBOARD_ACCESS_CODE_MAX_LENGTH)
  code!: string;
}
