import { Body, Controller, Get, Inject, Put, Req, forwardRef } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { IWebhookRecipient } from '@zalobot/contracts';
import { requireDashboardAdmin } from '../../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../../reports/reports-token.service';
import { UsersService } from '../../users/users.service';
import { UpdateWebhookRecipientsDto } from './dto/update-webhook-recipients.dto';
import { WebhookRecipientService } from './webhook-recipient.service';

/**
 * Settings → Webhook. Dashboard admins only; kept apart from `ZcaWebhookController`, whose routes
 * take the webhook API key instead of a dashboard login.
 */
@ApiTags('webhook')
@ApiBearerAuth('bearer-jwt')
@Controller('webhooks/recipients')
export class WebhookRecipientsController {
  constructor(
    private readonly recipients: WebhookRecipientService,
    private readonly tokens: ReportsTokenService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người nhận webhook' })
  public async list(@Req() req: Request): Promise<{ data: IWebhookRecipient[] }> {
    this.admin(req);
    return { data: await this.recipients.list() };
  }

  @Put()
  @ApiOperation({ summary: 'Thay toàn bộ danh sách người nhận webhook' })
  public async replace(
    @Req() req: Request,
    @Body() dto: UpdateWebhookRecipientsDto,
  ): Promise<{ data: IWebhookRecipient[] }> {
    this.admin(req);
    return { data: await this.recipients.replace(dto.recipients) };
  }

  private admin(req: Request): string | number {
    return requireDashboardAdmin(req, this.tokens, this.usersService);
  }
}
