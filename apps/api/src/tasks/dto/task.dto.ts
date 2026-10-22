import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  REMINDER_TARGET_LIMITS,
  REMINDER_TARGET_MODES,
  REMINDER_TIME_LIMITS,
  type ReminderTargetMode,
  type TaskStatus,
} from '@zalobot/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

  @ApiPropertyOptional({ example: '2026-10-23T08:00:00.000Z', description: 'One reminder time' })
  @IsOptional()
  @IsISO8601()
  remindAt?: string;

  @ApiPropertyOptional({ type: [String], description: 'Reminder times (ISO); wins over remindAt' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TIME_LIMITS.MAX_TIMES)
  @IsISO8601({}, { each: true })
  remindTimes?: string[];

  @ApiPropertyOptional({ description: 'Zalo chat for the reminder; defaults to your private chat' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  remindChatId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Members of the reminder group to remind' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TARGET_LIMITS.MAX_USERS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  remindUserIds?: string[];

  @ApiPropertyOptional({ enum: REMINDER_TARGET_MODES })
  @IsOptional()
  @IsIn(REMINDER_TARGET_MODES)
  remindMode?: ReminderTargetMode;
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

  @ApiPropertyOptional({ description: 'One ISO time; empty string clears every reminder' })
  @IsOptional()
  @ValidateIf((_dto: UpdateTaskDto, value: unknown) => value !== '')
  @IsISO8601()
  remindAt?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replaces the reminder times; [] clears them',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TIME_LIMITS.MAX_TIMES)
  @IsISO8601({}, { each: true })
  remindTimes?: string[];

  @ApiPropertyOptional({ description: 'Zalo chat for the reminder' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  remindChatId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Group members to remind; [] clears them' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TARGET_LIMITS.MAX_USERS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  remindUserIds?: string[];

  @ApiPropertyOptional({ enum: REMINDER_TARGET_MODES })
  @IsOptional()
  @IsIn(REMINDER_TARGET_MODES)
  remindMode?: ReminderTargetMode;
}
