import {
  BadGatewayException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThreadType } from 'zca-js';
import type { IWebhookSendMessageResponse } from '@zalobot/contracts';
import { ZcaService } from '../zca.service';
import { ZcaMessengerService } from '../zca-messenger.service';
import { OutgoingMemoryKind } from '../memory/memory-kind';
import { WebhookSendMessageDto } from './dto/webhook-send-message.dto';
import { WebhookApiKeyGuard } from './guards/webhook-api-key.guard';
import { WEBHOOK_MAX_CALLS, WebhookRateLimiter } from './webhook-rate-limiter';

@ApiTags('webhook')
@Controller('webhooks')
@UseGuards(WebhookApiKeyGuard)
export class ZcaWebhookController {
  private readonly logger = new Logger(ZcaWebhookController.name);

  constructor(
    private readonly zcaService: ZcaService,
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly rateLimiter: WebhookRateLimiter,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook gửi tin nhắn Zalo',
    description:
      'Gửi tin nhắn tự động từ bên ngoài tới một người dùng hoặc một nhóm Zalo thông qua tài khoản bot.',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'Khóa API bí mật WEBHOOK_API_KEY (hoặc gửi qua Authorization: Bearer)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Tin nhắn đã được gửi thành công qua Zalo.' })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ (thiếu, rỗng hoặc quá dài).',
  })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ hoặc bị thiếu.' })
  @ApiResponse({ status: 404, description: 'Webhook đang tắt (chưa đặt WEBHOOK_API_KEY).' })
  @ApiResponse({ status: 429, description: `Vượt quá ${WEBHOOK_MAX_CALLS} lần gọi mỗi phút.` })
  @ApiResponse({ status: 502, description: 'Gửi tin nhắn qua Zalo thất bại.' })
  @ApiResponse({ status: 503, description: 'Tài khoản Zalo bot chưa đăng nhập.' })
  public async sendMessage(
    @Body() dto: WebhookSendMessageDto,
  ): Promise<IWebhookSendMessageResponse> {
    if (!(await this.rateLimiter.tryCall())) {
      this.logger.warn(`Webhook call rejected: rate limit reached. Target: ${dto.targetId}`);
      throw new HttpException(
        `Webhook chỉ cho phép tối đa ${WEBHOOK_MAX_CALLS} lần gọi mỗi phút. Vui lòng thử lại sau.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.zcaService.isLoggedIn()) {
      this.logger.warn(`Webhook call rejected: ZCA is not logged in. Target: ${dto.targetId}`);
      throw new ServiceUnavailableException(
        'Tài khoản Zalo bot (ZCA) hiện chưa đăng nhập. Vui lòng đăng nhập qua dashboard trước khi gửi tin.',
      );
    }

    let threadType: ThreadType | undefined;
    if (dto.threadType === 'group') {
      threadType = ThreadType.Group;
    } else if (dto.threadType === 'user') {
      threadType = ThreadType.User;
    }

    this.logger.log(
      `Webhook sending message to target ${dto.targetId} (type: ${dto.threadType || 'auto'}): "${dto.message.slice(0, 50)}${dto.message.length > 50 ? '...' : ''}"`,
    );

    // A notice from another system, not the bot's own chat: memory stores it as `system`.
    const result = await OutgoingMemoryKind.run('system', () =>
      this.zcaMessenger.sendMessageWithResult(dto.targetId, dto.message, threadType),
    );

    // `success` without a msgId means nothing went out; the caller must not see that as sent.
    if (!result.success || !result.msgId) {
      this.logger.error(`Failed to send webhook message to target ${dto.targetId}`);
      throw new BadGatewayException(
        'Không thể gửi tin nhắn qua Zalo bot. Vui lòng kiểm tra lại targetId hoặc trạng thái kết nối của bot.',
      );
    }

    return {
      success: true,
      data: {
        targetId: dto.targetId,
        msgId: result.msgId,
        cliMsgId: result.cliMsgId,
      },
    };
  }
}
