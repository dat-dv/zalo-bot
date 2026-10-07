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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZaloService } from './zalo.service';
import { ZaloWebhookPayload } from './dto/zalo-webhook.dto';

@ApiTags('Zalo Webhook & Bot')
@Controller('zalo')
export class ZaloController {
  private readonly logger = new Logger(ZaloController.name);

  constructor(private readonly zaloService: ZaloService) {}

  @Get('webhook')
  @ApiOperation({ summary: 'Kiểm tra webhook Zalo hoặc xác thực challenge từ Zalo' })
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

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận sự kiện Webhook từ Zalo Official Account' })
  @ApiResponse({ status: 200, description: 'Đã xử lý sự kiện webhook thành công' })
  public async handleWebhook(
    @Body() payload: ZaloWebhookPayload,
    @Headers('x-zes-signature') signature?: string,
    @Headers('x-timestamp') timestamp?: string,
  ): Promise<{ error: number; message: string }> {
    const isSignatureValid = this.zaloService.verifySignature(
      signature,
      payload as unknown as Record<string, unknown>,
      timestamp || payload.timestamp,
    );

    if (!isSignatureValid) {
      this.logger.warn('Rejected Zalo webhook due to signature verification failure.');
      throw new UnauthorizedException('Chữ ký Webhook Zalo không hợp lệ.');
    }

    // Process webhook event asynchronously to return immediate 200 OK to Zalo
    this.zaloService.handleWebhookEvent(payload).catch((err) => {
      this.logger.error(`Error processing Zalo webhook event: ${(err as Error).message}`);
    });

    return { error: 0, message: 'Success' };
  }
}
