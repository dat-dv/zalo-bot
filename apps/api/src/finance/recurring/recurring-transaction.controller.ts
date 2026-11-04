import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  forwardRef,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type {
  ICreateRecurringRequest,
  IRecordOccurrenceRequest,
  IUpdateRecurringRequest,
} from '@zalobot/contracts';
import { getDashboardUserId } from '../../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../../reports/reports-token.service';
import { UsersService } from '../../users/users.service';
import { RecurringTransactionService } from './recurring-transaction.service';

/** Fixed income and expenses. Part of the shared ledger, so every signed-in user may manage them. */
@ApiTags('Recurring transactions')
@ApiBearerAuth('bearer-jwt')
@Controller('recurring-transactions')
export class RecurringTransactionController {
  constructor(
    private readonly recurring: RecurringTransactionService,
    private readonly tokens: ReportsTokenService,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
  ) {}

  private actorId(req: Request): string {
    return String(getDashboardUserId(req, this.tokens));
  }

  private async actor(req: Request): Promise<{ userId: string; name?: string }> {
    const userId = this.actorId(req);
    const names = await this.users
      .resolveZaloNames([userId])
      .catch(() => new Map<string, string>());
    return { userId, name: names.get(userId) };
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách khoản cố định và các kỳ đang chờ ghi' })
  async list(@Req() req: Request) {
    this.actorId(req);
    return { data: await this.recurring.list() };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo khoản cố định' })
  async create(@Req() req: Request, @Body() body: ICreateRecurringRequest) {
    return { data: await this.recurring.create(body, await this.actor(req)) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa, tạm dừng hoặc chạy lại khoản cố định' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: IUpdateRecurringRequest,
  ) {
    this.actorId(req);
    return { data: await this.recurring.update(id, body) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá khoản cố định; giao dịch đã ghi vẫn giữ nguyên' })
  async remove(@Req() req: Request, @Param('id') id: string) {
    this.actorId(req);
    if (!(await this.recurring.remove(id))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  @Post('occurrences/:id/record')
  @ApiOperation({ summary: 'Ghi một kỳ đang chờ thành giao dịch' })
  async record(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: IRecordOccurrenceRequest,
  ) {
    const actor = await this.actor(req);
    const transaction = await this.recurring.recordOccurrence(id, body, {
      ...actor,
      source: 'dashboard',
    });
    return { data: { transactionId: transaction.id } };
  }

  @Post('occurrences/:id/skip')
  @ApiOperation({ summary: 'Bỏ qua một kỳ đang chờ' })
  async skip(@Req() req: Request, @Param('id') id: string) {
    this.actorId(req);
    await this.recurring.skipOccurrence(id);
    return { data: { skipped: true } };
  }
}
