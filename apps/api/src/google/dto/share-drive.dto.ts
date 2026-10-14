import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsIn } from 'class-validator';

export class ShareDriveDto {
  @ApiProperty({ description: 'ID channel / nhóm Zalo hoặc user', example: 'g-123456789' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({ description: 'Tài khoản Gmail cần cấp quyền', example: 'user@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Quyền truy cập (mặc định reader)',
    example: 'reader',
    required: false,
  })
  @IsOptional()
  @IsIn(['reader', 'commenter', 'writer'])
  role?: 'reader' | 'commenter' | 'writer';
}
