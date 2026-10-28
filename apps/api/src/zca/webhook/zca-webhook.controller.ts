import {
  BadGatewayException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
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
  IWebhookRecipient,
  IWebhookSendMessageResponse,
  IWebhookSendResult,
  IWebhookTargetsResponse,
} from '@zalobot/contracts';
import { ZcaService, type AvailableThread } from '../zca.service';
import type { ZcaDirectoryEntry } from '../zca-directory-cache';
import { ZcaMessengerService } from '../zca-messenger.service';
import { OutgoingMemoryKind } from '../memory/memory-kind';
import { WebhookSendMessageDto } from './dto/webhook-send-message.dto';
import { WebhookTargetsQueryDto } from './dto/webhook-targets-query.dto';
import { WebhookApiKeyGuard } from './guards/webhook-api-key.guard';
import { WEBHOOK_MAX_CALLS, WebhookCallScope, WebhookRateLimiter } from './webhook-rate-limiter';
import { toWebhookTargets } from './webhook-targets';
import { WebhookRecipientService } from './webhook-recipient.service';

@ApiTags('webhook')
@Controller('webhooks')
@UseGuards(WebhookApiKeyGuard)
export class ZcaWebhookController {
  private readonly logger = new Logger(ZcaWebhookController.name);

  constructor(
    private readonly zcaService: ZcaService,
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly rateLimiter: WebhookRateLimiter,
    private readonly recipients: WebhookRecipientService,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook gửi tin nhắn Zalo',
    description:
      'Gửi tin nhắn tự động từ bên ngoài qua tài khoản bot tới người nhận đã chọn ở Cài đặt → Webhook: tất cả, hoặc chỉ `targetId` nếu có truyền.',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'Khóa API bí mật WEBHOOK_API_KEY (hoặc gửi qua Authorization: Bearer)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Ít nhất một người nhận đã nhận được tin; `results` ghi kết quả từng người.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ (thiếu, rỗng hoặc quá dài).',
  })
  @ApiResponse({ status: 401, description: 'API key không hợp lệ hoặc bị thiếu.' })
  @ApiResponse({ status: 403, description: '`targetId` không nằm trong danh sách người nhận.' })
  @ApiResponse({ status: 404, description: 'Webhook đang tắt (chưa đặt WEBHOOK_API_KEY).' })
  @ApiResponse({ status: 409, description: 'Chưa chọn người nhận nào ở Cài đặt → Webhook.' })
  @ApiResponse({ status: 429, description: `Vượt quá ${WEBHOOK_MAX_CALLS.send} lần gọi mỗi phút.` })
  @ApiResponse({ status: 502, description: 'Không gửi được cho người nhận nào.' })
  @ApiResponse({ status: 503, description: 'Tài khoản Zalo bot chưa đăng nhập.' })
  public async sendMessage(
    @Body() dto: WebhookSendMessageDto,
  ): Promise<IWebhookSendMessageResponse> {
    await this.assertWithinRateLimit('send');
    this.assertLoggedIn();

    const targetLabel = dto.targetId ?? 'all recipients';
    const targets = await this.resolveTargets(dto.targetId?.trim());

    this.logger.log(
      `Webhook sending message to ${targets.length} recipient(s) (${targetLabel}): "${dto.message.slice(0, 50)}${dto.message.length > 50 ? '...' : ''}"`,
    );

    // One at a time: ZCA sends from a single account, and a burst looks like spam to Zalo.
    const results: IWebhookSendResult[] = [];
    for (const target of targets) {
      results.push(await this.sendTo(target, dto.message));
    }

    const sent = results.filter((result) => result.success).length;
    // Nothing went out at all; the caller must not see that as sent.
    if (sent === 0) {
      this.logger.error(`Failed to send webhook message to ${targetLabel}`);
      throw new BadGatewayException(
        'Không thể gửi tin nhắn qua Zalo bot. Vui lòng kiểm tra lại người nhận hoặc trạng thái kết nối của bot.',
      );
    }

    return { success: true, data: { sent, failed: results.length - sent, results } };
  }

  @Get('targets')
  @ApiOperation({
    summary: 'Danh sách người và nhóm có thể nhận tin',
    description:
      'Người nhận đã chọn ở Cài đặt → Webhook, kèm avatar từ danh bạ Zalo của bot, để hệ thống bên ngoài cho người dùng chọn targetId.',
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
    const [recipients, threads] = await Promise.all([
      this.recipients.list(),
      this.zcaService.getAvailableThreads(false),
    ]);
    return {
      success: true,
      data: {
        items: toWebhookTargets(recipientEntries(recipients, threads), query),
        fetchedAt: this.zcaService.getDirectoryFetchedAt(),
      },
    };
  }

  /** The saved recipients, or the one named by `targetId`, which must be one of them. */
  private async resolveTargets(targetId: string | undefined): Promise<IWebhookRecipient[]> {
    if (targetId) {
      const recipient = await this.recipients.find(targetId);
      if (!recipient) {
        this.logger.warn(`Webhook call rejected: ${targetId} is not a webhook recipient`);
        throw new ForbiddenException(
          'targetId không nằm trong danh sách người nhận webhook. Thêm người nhận ở Cài đặt → Webhook trên dashboard.',
        );
      }
      return [recipient];
    }

    const all = await this.recipients.list();
    if (all.length === 0) {
      throw new ConflictException(
        'Chưa cấu hình người nhận webhook. Chọn người nhận ở Cài đặt → Webhook trên dashboard.',
      );
    }
    return all;
  }

  private async sendTo(target: IWebhookRecipient, message: string): Promise<IWebhookSendResult> {
    const threadType = target.threadType === 'group' ? ThreadType.Group : ThreadType.User;
    try {
      // A notice from another system, not the bot's own chat: memory stores it as `system`.
      const result = await OutgoingMemoryKind.run('system', () =>
        this.zcaMessenger.sendMessageWithResult(target.threadId, message, threadType),
      );
      // `success` without a msgId means nothing went out.
      if (result.success && result.msgId) {
        return {
          targetId: target.threadId,
          threadType: target.threadType,
          success: true,
          msgId: result.msgId,
          cliMsgId: result.cliMsgId,
        };
      }
    } catch (error) {
      this.logger.error(`Webhook message to ${target.threadId} threw: ${String(error)}`);
    }
    this.logger.error(`Failed to send webhook message to target ${target.threadId}`);
    return { targetId: target.threadId, threadType: target.threadType, success: false };
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

/**
 * Saved recipients with name, avatar and member count from the directory. A recipient Zalo no
 * longer returns (or only as a placeholder) keeps its saved name and has no avatar.
 */
export function recipientEntries(
  recipients: readonly IWebhookRecipient[],
  threads: readonly AvailableThread[],
): ZcaDirectoryEntry[] {
  const directory = new Map(
    threads.filter((thread) => !thread.missingFromZalo).map((thread) => [thread.id, thread]),
  );
  return recipients.map((recipient) => {
    const thread = directory.get(recipient.threadId);
    return {
      id: recipient.threadId,
      name: thread?.name || recipient.threadName || recipient.threadId,
      type: recipient.threadType,
      avatar: thread?.avatar,
      totalMembers: thread?.totalMembers,
    };
  });
}
