import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListCalendarEventsQueryDto {
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsISO8601()
  timeMin: string;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  @IsISO8601()
  timeMax: string;

  @ApiPropertyOptional({ description: 'Tìm theo tiêu đề, địa điểm, mô tả' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;
}

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Họp nhóm' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary: string;

  @ApiProperty({ example: '2026-10-23T09:00:00+07:00' })
  @IsISO8601()
  startDateTime: string;

  @ApiProperty({
    example: '2026-10-23T10:00:00+07:00',
    description: 'Exclusive end. All-day events: midnight after the last day.',
  })
  @IsISO8601()
  endDateTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({ example: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ example: [60, 30, 10, 0], description: 'Minutes before start' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(40320, { each: true })
  reminderMinutes?: number[];
}

export class UpdateCalendarEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startDateTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endDateTime?: string;

  @ApiPropertyOptional({ description: 'Empty string clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Empty string clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ example: [60, 30, 10, 0] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(40320, { each: true })
  reminderMinutes?: number[];
}
