import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { IDeployNotifyRequest } from '@zalobot/contracts';

export class DeployNotifyDto implements IDeployNotifyRequest {
  @ApiPropertyOptional({ description: 'Thông điệp hoặc ghi chú triển khai' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Phiên bản ứng dụng (VD: v1.0.0)' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Mã commit Git' })
  @IsOptional()
  @IsString()
  commit?: string;

  @ApiPropertyOptional({ description: 'Tên nhánh Git (VD: main)' })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ description: 'Tên môi trường (VD: production)' })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({ description: 'Người thực hiện triển khai' })
  @IsOptional()
  @IsString()
  deployedBy?: string;
}
