import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { ReminderTargetService } from './reminder-target.service';

/** Chats and group members the dashboard can send task reminders and reminders to. */
@ApiTags('Reminders')
@ApiBearerAuth('bearer-jwt')
@Controller('reminder-targets')
export class ReminderTargetsController {
  constructor(
    private readonly targets: ReminderTargetService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get('channels')
  @ApiOperation({ summary: 'Kênh Zalo có thể nhận nhắc' })
  async channels(@Req() req: Request) {
    return { data: await this.targets.listChannels(this.userId(req)) };
  }

  @Get('channels/:chatId/members')
  @ApiOperation({ summary: 'Thành viên của một nhóm đang listen, để chọn người được nhắc' })
  async members(@Req() req: Request, @Param('chatId') chatId: string) {
    this.userId(req);
    return { data: await this.targets.listMembers(chatId) };
  }

  /** The dashboard user; also rejects requests without a valid dashboard token. */
  private userId(req: Request): string {
    return String(getDashboardUserId(req, this.tokens));
  }
}
