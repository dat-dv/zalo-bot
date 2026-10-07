import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader, ApiBody } from '@nestjs/swagger';
import { ZaloService } from './zalo.service';
import { ZaloWebhookPayloadDto } from './dto/zalo-webhook.dto';

@ApiTags('Zalo Bot Webhook')
@Controller()
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(private readonly zaloService: ZaloService) {}

  @Get(['webhook', 'zalo/webhook', 'api/webhook', 'api/zalo/webhook'])
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

  @Post(['webhook', 'zalo/webhook', 'api/webhook', 'api/zalo/webhook'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận sự kiện Webhook từ Zalo Bot Platform' })
  @ApiHeader({
    name: 'X-Bot-Api-Secret-Token',
    required: false,
    description: 'Secret token xác thực từ Zalo Bot Platform (nếu đã cấu hình)',
  })
  @ApiBody({
    type: ZaloWebhookPayloadDto,
    description: 'Dữ liệu sự kiện tương tác từ Zalo Bot',
  })
  @ApiResponse({ status: 200, description: 'Đã nhận và xử lý sự kiện webhook' })
  public handleWebhook(
    @Body() update: ZaloWebhookPayloadDto,
    @Headers('x-bot-api-secret-token') secretToken?: string,
  ): { ok: boolean } {
    this.logger.debug('Received webhook payload from Zalo Bot');
    this.logger.log('update', JSON.stringify(update));
    if (typeof this.zaloService.processInput === 'function') {
      void this.zaloService.processInput(update, secretToken);
    } else if (typeof (this.zaloService as any).processUpdate === 'function') {
      void (this.zaloService as any).processUpdate(update, secretToken);
    }
    return { ok: true };
  }
}
