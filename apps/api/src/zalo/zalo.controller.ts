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
import { ConfigService } from '@nestjs/config';
import { InputProcessor } from './input-processor.service';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { ZaloWebhookPayloadDto } from './dto/zalo-webhook.dto';

@ApiTags('Zalo Bot Webhook')
@Controller()
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(
    private readonly inputProcessor: InputProcessor,
    private readonly zaloMessageParser: ZaloMessageParser,
    private readonly configService: ConfigService,
  ) {}

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
    @Body() payload: ZaloWebhookPayloadDto,
    @Headers('x-bot-api-secret-token') secretToken?: string,
  ): { ok: boolean } {
    this.logger.debug('Received webhook payload from Zalo Bot');
    this.logger.log('update', JSON.stringify(payload));

    const configuredSecretToken = this.configService.get<string>('zalo.secretToken');
    if (configuredSecretToken && secretToken !== configuredSecretToken) {
      this.logger.warn('Unauthorized Zalo webhook request: invalid X-Bot-Api-Secret-Token.');
      return { ok: false };
    }

    const input = this.zaloMessageParser.parse(payload);
    void this.inputProcessor.process(input);

    return { ok: true };
  }
}
