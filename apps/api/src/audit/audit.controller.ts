import { Controller, Get, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { IAuditLogDetail, IAuditLogListResponse, IApiResponse } from '@zalobot/contracts';
import { requireDashboardAdmin } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from '../users/users.service';
import { parseAuditLogListQuery } from './audit-log-query';
import { AuditService } from './audit.service';

/** Activity log: before/after data can hold personal details, so admins only. */
@ApiTags('Audit Logs (Admin Only)')
@ApiBearerAuth('bearer-jwt')
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly tokens: ReportsTokenService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Nhật ký hoạt động: lọc, phân trang, mới nhất trước (Admin Only)' })
  async list(
    @Req() req: Request,
    @Query() query: Record<string, unknown>,
  ): Promise<IApiResponse<IAuditLogListResponse>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    return { data: await this.audit.list(parseAuditLogListQuery(query)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một thay đổi kèm dữ liệu trước/sau (Admin Only)' })
  async get(@Req() req: Request, @Param('id') id: string): Promise<IApiResponse<IAuditLogDetail>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    const detail = await this.audit.get(id);
    if (!detail) throw new NotFoundException('Audit log not found.');
    return { data: detail };
  }
}
