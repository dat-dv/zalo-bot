import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  REMINDER_TARGET_LIMITS,
  REMINDER_TARGET_MODES,
  REMINDER_TIME_LIMITS,
  type ReminderTargetMode,
  type TaskStatus,
} from '@zalobot/contracts';
import { Transform, type TransformFnParams, Type } from 'class-transformer';
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

/** `remindTimes` exactly as the client sent it (undefined stays undefined). */
function keepRawRemindTimes({ obj }: TransformFnParams): unknown {
  return isRecord(obj) ? obj.remindTimes : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

  @ApiPropertyOptional({
    type: 'array',
    description:
      'Reminder times: ISO strings or { remindAt, repeatType?, repeatWeekdays? }; wins over remindAt',
  })
  // Items are ISO strings or `{ remindAt, repeatType?, repeatWeekdays? }`; keep them as sent,
  // because implicit conversion would turn each object into `[]`. parseRemindTimesBody checks them.
  @Transform(keepRawRemindTimes)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TIME_LIMITS.MAX_TIMES)
  remindTimes?: unknown[];

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

  @ApiPropertyOptional({ nullable: true, description: 'Remind again every N minutes; null = off' })
  @IsOptional()
  @IsInt()
  nagEveryMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'How many times to remind again' })
  @IsOptional()
  @IsInt()
  nagCount?: number | null;
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
    type: 'array',
    description:
      'Replaces the reminder times: ISO strings or { remindAt, repeatType?, repeatWeekdays? }; [] clears them',
  })
  // Items are ISO strings or `{ remindAt, repeatType?, repeatWeekdays? }`; keep them as sent,
  // because implicit conversion would turn each object into `[]`. parseRemindTimesBody checks them.
  @Transform(keepRawRemindTimes)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REMINDER_TIME_LIMITS.MAX_TIMES)
  remindTimes?: unknown[];

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

  @ApiPropertyOptional({ nullable: true, description: 'Remind again every N minutes; null = off' })
  @IsOptional()
  @IsInt()
  nagEveryMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'How many times to remind again' })
  @IsOptional()
  @IsInt()
  nagCount?: number | null;
}
