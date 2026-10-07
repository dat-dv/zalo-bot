import { Controller, Get, Query, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GoogleAuthService } from './google-auth.service';
import { renderSuccessHtml, renderErrorHtml } from './templates/oauth-html.template';

@ApiTags('Google Auth & System Health')
@Controller()
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(private readonly googleAuthService: GoogleAuthService) {}

  @Get(['', 'health'])
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
    const userId = state ? Number(state) : NaN;

    if (error || !code) {
      this.logger.error(`Google OAuth callback error: ${error || 'Missing authorization code'}`);
      res.status(400).send(renderErrorHtml(error || 'Không nhận được mã xác thực từ Google.'));
      return;
    }

    if (!userId || isNaN(userId)) {
      this.logger.error(`Google OAuth callback invalid state (userId): ${state}`);
      res
        .status(400)
        .send(
          renderErrorHtml('Không tìm thấy thông tin định danh người dùng (State ID).'),
        );
      return;
    }

    try {
      await this.googleAuthService.exchangeCodeForTokens(userId, code);
      this.logger.log(`Google OAuth callback completed successfully for user ${userId}`);

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
