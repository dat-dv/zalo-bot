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
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { InputProcessor } from './input-processor.service';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { ZaloWebhookPayload, ZaloWebhookPayloadDto } from './dto/zalo-webhook.dto';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';

@ApiTags('Zalo Bot Webhook')
@BypassTransform()
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
    this.logger.debug('Received webhook payload from Zalo Bot ' + challenge + ' ' + hubChallenge);
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
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: ZaloWebhookPayload,
    @Headers('x-bot-api-secret-token') secretToken?: string,
  ): { ok: boolean } {
    // Log RAW body (trước khi ValidationPipe strip) để debug khi Zalo gửi fields không khai báo trong DTO
    const rawBody = req.rawBody?.toString('utf-8');
    if (rawBody) {
      try {
        const rawParsed: unknown = JSON.parse(rawBody);
        this.logger.debug(
          `[RAW] Zalo webhook payload (before pipe):\n${JSON.stringify(rawParsed, null, 2)}`,
        );
      } catch {
        this.logger.debug(`[RAW] Zalo webhook payload (before pipe, non-JSON):\n${rawBody}`);
      }
    }

    // Log payload sau khi ValidationPipe xử lý để so sánh
    this.logger.debug(
      `[PARSED] Zalo webhook payload (after pipe):\n${JSON.stringify(payload, null, 2)}`,
    );

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
