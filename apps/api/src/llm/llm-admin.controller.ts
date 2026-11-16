import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { IApiResponse, ILlmProviderPingResult, ILlmProviderStatus } from '@zalobot/contracts';
import { requireDashboardAdmin } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from '../users/users.service';
import { LlmProviderConfigService } from './llm-provider-config.service';
import {
  LlmProviderInputError,
  parseCreateLlmProvider,
  parseReorderLlmProviders,
  parseUpdateLlmProvider,
} from './llm-provider-input';
import { LlmService } from './llm.service';

type RecordBody = Record<string, unknown>;

function parseBody<T>(parse: (body: RecordBody) => T, body: unknown): T {
  const record: RecordBody = typeof body === 'object' && body !== null ? { ...body } : {};
  try {
    return parse(record);
  } catch (error: unknown) {
    if (error instanceof LlmProviderInputError) throw new BadRequestException(error.message);
    throw error;
  }
}

/**
 * The bot's LLM chain: which AIs it calls, in what order, with which keys. Admins only, since it
 * holds paid API keys and a ping is a paid call. API keys go in, never out.
 */
@ApiTags('LLM (Admin Only)')
@ApiBearerAuth('bearer-jwt')
@Controller('llm/providers')
export class LlmAdminController {
  constructor(
    private readonly llm: LlmService,
    private readonly providers: LlmProviderConfigService,
    private readonly tokens: ReportsTokenService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Chuỗi AI của bot theo thứ tự gọi, gồm cả AI đang tắt (Admin Only)' })
  async list(@Req() req: Request): Promise<IApiResponse<ILlmProviderStatus[]>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    return { data: await this.providers.listStatuses() };
  }

  @Post()
  @ApiOperation({ summary: 'Thêm một AI vào cuối chuỗi (Admin Only)' })
  async create(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<IApiResponse<ILlmProviderStatus>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    return { data: await this.providers.create(parseBody(parseCreateLlmProvider, body)) };
  }

  /** Declared before the `:id` routes so `order` is never read as an id. */
  @Put('order')
  @ApiOperation({ summary: 'Đặt lại thứ tự gọi của cả chuỗi (Admin Only)' })
  async reorder(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<IApiResponse<ILlmProviderStatus[]>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    return { data: await this.providers.reorder(parseBody(parseReorderLlmProviders, body)) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa một AI; API key bỏ trống thì giữ key cũ (Admin Only)' })
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<IApiResponse<ILlmProviderStatus>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    return { data: await this.providers.update(id, parseBody(parseUpdateLlmProvider, body)) };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá một AI khỏi chuỗi (Admin Only)' })
  async remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    requireDashboardAdmin(req, this.tokens, this.users);
    await this.providers.remove(id);
  }

  @Post(':id/ping')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gọi thử đúng một AI, không qua fallback (Admin Only)' })
  async ping(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IApiResponse<ILlmProviderPingResult>> {
    requireDashboardAdmin(req, this.tokens, this.users);
    const result = await this.llm.pingProvider(id);
    if (!result) throw new NotFoundException('LLM provider not found.');
    return { data: result };
  }
}
