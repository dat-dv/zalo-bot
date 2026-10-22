import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TaskStatus } from '@zalobot/contracts';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const TASK_STATUSES: TaskStatus[] = ['needsAction', 'completed'];

export class ListTasksQueryDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Tìm theo tiêu đề, ghi chú' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Nộp báo cáo quý' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-10-23T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  due?: string;

  @ApiPropertyOptional({ example: '2026-10-23T08:00:00.000Z', description: 'Reminder time' })
  @IsOptional()
  @IsISO8601()
  remindAt?: string;

  @ApiPropertyOptional({ description: 'Zalo chat for the reminder; defaults to your private chat' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  remindChatId?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  title?: string;

  @ApiPropertyOptional({ description: 'Empty string clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  notes?: string;

  @ApiPropertyOptional({ description: 'ISO date-time; empty string clears it' })
  @IsOptional()
  @ValidateIf((_dto: UpdateTaskDto, value: unknown) => value !== '')
  @IsISO8601()
  due?: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'ISO date-time; empty string clears the reminder' })
  @IsOptional()
  @ValidateIf((_dto: UpdateTaskDto, value: unknown) => value !== '')
  @IsISO8601()
  remindAt?: string;

  @ApiPropertyOptional({ description: 'Zalo chat for the reminder' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  remindChatId?: string;
}
