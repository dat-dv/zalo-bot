import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThreadType } from 'zca-js';
import type {
  IWebhookCallLimit,
  IWebhookSendMessageResponse,
  IWebhookStatusResponse,
  IWebhookTargetsResponse,
} from '@zalobot/contracts';
import { ZcaService } from '../zca.service';
import { ZcaMessengerService } from '../zca-messenger.service';
import { OutgoingMemoryKind } from '../memory/memory-kind';
import { WebhookSendMessageDto } from './dto/webhook-send-message.dto';
import { WebhookTargetsQueryDto } from './dto/webhook-targets-query.dto';
import { WebhookApiKeyGuard } from './guards/webhook-api-key.guard';
import { WebhookIpLimitGuard } from './guards/webhook-ip-limit.guard';
import {
  WEBHOOK_MAX_CALLS,
  WEBHOOK_WINDOW_SECONDS,
  WebhookCallScope,
  WebhookRateLimiter,
} from './webhook-rate-limiter';
import { toWebhookTargets } from './webhook-targets';

@ApiTags('webhook')
@Controller('webhooks')
// Order matters: the IP limit runs before the key check so keyless floods stop early.
@UseGuards(WebhookIpLimitGuard, WebhookApiKeyGuard)
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
  @ApiResponse({ status: 429, description: `Vượt quá ${WEBHOOK_MAX_CALLS.send} lần gọi mỗi phút.` })
  @ApiResponse({ status: 502, description: 'Gửi tin nhắn qua Zalo thất bại.' })
  @ApiResponse({ status: 503, description: 'Tài khoản Zalo bot chưa đăng nhập.' })
  public async sendMessage(
    @Body() dto: WebhookSendMessageDto,
  ): Promise<IWebhookSendMessageResponse> {
    await this.assertWithinRateLimit('send');
    this.assertLoggedIn();

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

  @Get('targets')
  @ApiOperation({
    summary: 'Danh sách người và nhóm có thể nhận tin',
    description:
      'Bạn bè và nhóm Zalo của tài khoản bot, kèm avatar, để hệ thống bên ngoài cho người dùng chọn targetId.',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'Khóa API bí mật WEBHOOK_API_KEY (hoặc gửi qua Authorization: Bearer)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Danh sách người và nhóm.' })
  @ApiResponse({ status: 400, description: 'Tham số lọc không hợp lệ.' })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ hoặc bị thiếu.' })
  @ApiResponse({ status: 404, description: 'Webhook đang tắt (chưa đặt WEBHOOK_API_KEY).' })
  @ApiResponse({
    status: 429,
    description: `Vượt quá ${WEBHOOK_MAX_CALLS.targets} lần gọi mỗi phút.`,
  })
  @ApiResponse({ status: 503, description: 'Tài khoản Zalo bot chưa đăng nhập.' })
  public async listTargets(
    @Query() query: WebhookTargetsQueryDto,
  ): Promise<IWebhookTargetsResponse> {
    await this.assertWithinRateLimit('targets');
    this.assertLoggedIn();

    // Cached directory only: an outside caller must never make the bot refetch it from Zalo.
    // Placeholder rows (left groups, stale ids) cannot be messaged, so they are no target.
    const threads = (await this.zcaService.getAvailableThreads(false)).filter(
      (thread) => !thread.missingFromZalo,
    );
    return {
      success: true,
      data: {
        items: toWebhookTargets(threads, query),
        fetchedAt: this.zcaService.getDirectoryFetchedAt(),
      },
    };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Trạng thái bot cho hệ thống tích hợp',
    description:
      'Bot có gửi tin được ngay không và còn bao nhiêu lượt gọi trong phút này. Trả 200 kể cả khi bot mất đăng nhập.',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'Khóa API bí mật WEBHOOK_API_KEY (hoặc gửi qua Authorization: Bearer)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Trạng thái bot và số lượt gọi còn lại.' })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ hoặc bị thiếu.' })
  @ApiResponse({ status: 404, description: 'Webhook đang tắt (chưa đặt WEBHOOK_API_KEY).' })
  @ApiResponse({
    status: 429,
    description: `Vượt quá ${WEBHOOK_MAX_CALLS.status} lần gọi mỗi phút.`,
  })
  public async getStatus(): Promise<IWebhookStatusResponse> {
    await this.assertWithinRateLimit('status');

    // Never 503 here: callers poll this precisely to learn that the bot is logged out.
    const zaloLoggedIn = this.zcaService.isLoggedIn();
    const [send, targets] = await Promise.all([this.callLimit('send'), this.callLimit('targets')]);
    return {
      success: true,
      data: {
        ready: zaloLoggedIn,
        zaloLoggedIn,
        directoryFetchedAt: this.zcaService.getDirectoryFetchedAt(),
        limits: { send, targets },
        checkedAt: new Date().toISOString(),
      },
    };
  }

  private async callLimit(scope: WebhookCallScope): Promise<IWebhookCallLimit> {
    return {
      limit: WEBHOOK_MAX_CALLS[scope],
      remaining: await this.rateLimiter.remaining(scope),
      windowSeconds: WEBHOOK_WINDOW_SECONDS,
    };
  }

  private async assertWithinRateLimit(scope: WebhookCallScope): Promise<void> {
    if (await this.rateLimiter.tryCall(scope)) return;
    this.logger.warn(`Webhook ${scope} call rejected: rate limit reached.`);
    throw new HttpException(
      `Webhook chỉ cho phép tối đa ${WEBHOOK_MAX_CALLS[scope]} lần gọi mỗi phút. Vui lòng thử lại sau.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private assertLoggedIn(): void {
    if (this.zcaService.isLoggedIn()) return;
    this.logger.warn('Webhook call rejected: ZCA is not logged in.');
    throw new ServiceUnavailableException(
      'Tài khoản Zalo bot (ZCA) hiện chưa đăng nhập. Vui lòng đăng nhập qua dashboard trước khi gửi tin.',
    );
  }
}
