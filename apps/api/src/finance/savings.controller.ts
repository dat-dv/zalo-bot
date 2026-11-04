import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SAVING_MOVEMENT_TYPES, type SavingMovementType } from '@zalobot/contracts';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { SavingsService } from './savings.service';

type RecordBody = Record<string, unknown>;

function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${name} is required.`);
  }
  return value.trim();
}

/** Blank text clears the field, so an empty note is stored as no note. */
function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BadRequestException('Text value is invalid.');
  return value.trim() || undefined;
}

function isMovementType(value: unknown): value is SavingMovementType {
  return (SAVING_MOVEMENT_TYPES as readonly unknown[]).includes(value);
}

@ApiTags('Savings')
@ApiBearerAuth('bearer-jwt')
@Controller('saving-groups')
export class SavingsController {
  constructor(
    private readonly savings: SavingsService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhóm tiết kiệm' })
  async list(@Req() req: Request) {
    this.actorId(req);
    return { data: await this.savings.listGroups() };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo nhóm tiết kiệm' })
  async create(@Req() req: Request, @Body() body: RecordBody) {
    const actorId = this.actorId(req);
    return {
      data: await this.savings.createGroup(
        { name: requiredText(body.name, 'name'), note: optionalText(body.note) },
        actorId,
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy một nhóm tiết kiệm' })
  async detail(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.actorId(req);
    return { data: await this.savings.getGroup(id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa tên hoặc ghi chú của nhóm tiết kiệm' })
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RecordBody,
  ) {
    this.actorId(req);
    return {
      data: await this.savings.updateGroup(id, {
        name: body.name === undefined ? undefined : requiredText(body.name, 'name'),
        note: body.note === undefined ? undefined : (optionalText(body.note) ?? null),
      }),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Lưu trữ nhóm tiết kiệm đã hết tiền' })
  async archive(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.actorId(req);
    return { data: await this.savings.archiveGroup(id) };
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Lấy lịch sử nạp/rút của nhóm' })
  async movements(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    this.actorId(req);
    return { data: await this.savings.listMovements(id) };
  }

  @Post(':id/movements')
  @ApiOperation({ summary: 'Nạp, rút hoặc nhập số dư ban đầu cho nhóm' })
  async addMovement(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RecordBody,
  ) {
    const actorId = this.actorId(req);
    if (!isMovementType(body.type)) throw new BadRequestException('type is invalid.');
    return {
      data: await this.savings.addMovement(
        id,
        {
          type: body.type,
          amount: Number(body.amount),
          occurredAt: optionalText(body.occurredAt),
          note: optionalText(body.note),
        },
        actorId,
      ),
    };
  }

  @Delete(':id/movements/:movementId')
  @ApiOperation({ summary: 'Xoá một lượt nạp/rút' })
  async removeMovement(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('movementId', ParseUUIDPipe) movementId: string,
  ) {
    this.actorId(req);
    await this.savings.removeMovement(id, movementId);
    return { data: { deleted: true } };
  }

  private actorId(req: Request): string {
    return String(getDashboardUserId(req, this.tokens));
  }
}
