import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { IUserMergeRequest } from '@zalobot/contracts';

export class MergeUserDto implements IUserMergeRequest {
  @ApiProperty({ description: 'ID of the user that will receive all data of the source user' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  targetUserId!: string;
}
