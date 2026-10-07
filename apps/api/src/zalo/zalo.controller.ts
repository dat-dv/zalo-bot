import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZaloService } from './zalo.service';

@ApiTags('Zalo Bot Webhook')
@Controller()
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(private readonly zaloService: ZaloService) {}

  @Get(['webhook', 'zalo/webhook'])
  @ApiOperation({ summary: 'Kiểm tra trạng thái Webhook Zalo Bot' })
  @ApiResponse({ status: 200, description: 'Webhook Zalo hoạt động bình thường' })
  public verifyWebhook(
    @Query('challenge') challenge?: string,
    @Query('hub.challenge') hubChallenge?: string,
  ): unknown {
    if (challenge) {
      return challenge;
    }
    if (hubChallenge) {
      return hubChallenge;
    }
    return {
      status: 'ok',
      service: 'Zalo Bot Assistant Webhook',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(['webhook', 'zalo/webhook'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận sự kiện Webhook từ Zalo Bot' })
  @ApiResponse({ status: 200, description: 'Đã xử lý sự kiện webhook' })
  public handleWebhook(@Body() update: unknown): { ok: boolean } {
    this.logger.debug('Received webhook payload from Zalo Bot');
    this.zaloService.processUpdate(update);
    return { ok: true };
  }
}
