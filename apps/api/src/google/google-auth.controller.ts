import { Controller, Get, Query, Logger, Res, Optional, Inject, forwardRef } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GoogleAuthService } from './google-auth.service';
import { renderSuccessHtml, renderErrorHtml } from './templates/oauth-html.template';
import { ZaloService } from '../zalo/zalo.service';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';

@ApiTags('Google Auth & System Health')
@Controller()
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    @Optional()
    @Inject(forwardRef(() => ZaloService))
    private readonly zaloService?: ZaloService,
  ) {}

  @Get(['', 'health'])
  @BypassTransform()
  @ApiOperation({ summary: 'Kiểm tra trạng thái hoạt động của hệ thống (Health check)' })
  @ApiResponse({ status: 200, description: 'Hệ thống đang hoạt động bình thường' })
  public getHealth(): string {
    return '🟢 Zalo Bot Assistant is up and running!';
  }

  @Get(['oauth2callback', 'auth/google/callback', 'callback'])
  @ApiOperation({ summary: 'Google OAuth 2.0 Authorization Callback' })
  @ApiResponse({ status: 200, description: 'Xác thực thành công và lưu token' })
  @ApiResponse({ status: 400, description: 'Thiếu mã xác thực hoặc state ID không hợp lệ' })
  public async handleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const userId = state ? state.trim() : '';

    if (error || !code) {
      this.logger.error(`Google OAuth callback error: ${error || 'Missing authorization code'}`);
      res.status(400).send(renderErrorHtml(error || 'Không nhận được mã xác thực từ Google.'));
      return;
    }

    if (!userId) {
      this.logger.error(`Google OAuth callback invalid state (userId): ${state}`);
      res
        .status(400)
        .send(renderErrorHtml('Không tìm thấy thông tin định danh người dùng (State ID).'));
      return;
    }

    try {
      await this.googleAuthService.exchangeCodeForTokens(userId, code);
      this.logger.log(`Google OAuth callback completed successfully for user ${userId}`);

      // Gửi thông báo xác nhận thành công tới tài khoản Zalo của người dùng
      if (this.zaloService && userId) {
        try {
          await this.zaloService.sendMessage(
            userId,
            '🎉 KẾT NỐI GOOGLE THÀNH CÔNG!\n\nTài khoản Google (Calendar, Drive, Photos) của bạn đã được liên kết hoàn tất. Bây giờ bạn có thể bắt đầu sử dụng trợ lý rồi nhé! 🚀',
          );
        } catch (sendErr) {
          this.logger.warn(
            `Could not send confirmation message to Zalo user ${userId}: ${(sendErr as Error).message}`,
          );
        }
      }

      res.status(200).send(renderSuccessHtml());
    } catch (err) {
      const exchangeError = err as Error;
      this.logger.error(
        `Failed to exchange code in callback for user ${userId}: ${exchangeError.message}`,
      );
      res.status(500).send(renderErrorHtml(exchangeError.message));
    }
  }
}
