import { Controller, Get, HttpCode, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { IApiResponse, ILlmProviderPingResult, ILlmProviderStatus } from '@zalobot/contracts';
import { requireDashboardAdmin } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from '../users/users.service';
import { LlmService } from './llm.service';

/** Which LLMs the bot uses and whether each answers. A ping is a paid call, so admins only. */
@ApiTags('LLM (Admin Only)')
@ApiBearerAuth('bearer-jwt')
@Controller('llm/providers')
export class LlmAdminController {
  constructor(
    private readonly llm: LlmService,
    private readonly tokens: ReportsTokenService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Chuỗi LLM bot đang dùng, theo thứ tự gọi (Admin Only)' })
  list(@Req() req: Request): IApiResponse<ILlmProviderStatus[]> {
    requireDashboardAdmin(req, this.tokens, this.users);
    return { data: this.llm.getProviderStatuses() };
  }

  @Post(':name/ping')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gọi thử đúng một provider, không qua fallback (Admin Only)' })
  async ping(
    @Req() req: Request,
    @Param('name') name: string,
  ): Promise<IApiResponse<ILlmProviderPingResult>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    const result = await this.llm.pingProvider(name);
    if (!result) throw new NotFoundException('LLM provider not in the chain.');
    return { data: result };
  }
}
