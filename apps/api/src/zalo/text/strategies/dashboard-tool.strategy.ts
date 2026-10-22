import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { API_ROUTES } from '@zalobot/contracts';
import { ReportsTokenService } from '../../../reports/reports-token.service';
import { formatDashboardAccessCode } from '../../../reports/dashboard-access-code';

import * as fs from 'fs';
import { fromProjectRoot } from '../../../config/project-root';

@Injectable()
export class DashboardToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DASHBOARD;
  private readonly logger = new Logger(DashboardToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly configService: ConfigService,
    private readonly reportsTokens: ReportsTokenService,
  ) {}

  private resolveAppUrl(): string {
    // 1. Thử đọc URL từ file .env để bắt kịp tunnel vừa khởi động (không cần restart server)
    try {
      const envPath = fromProjectRoot('.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const matchWebhook = content.match(/^ZALO_WEBHOOK_URL=(.+)$/m);
        if (matchWebhook && matchWebhook[1]) {
          const val = matchWebhook[1].trim().replace(/^['"]+|['"]+$/g, '');
          const parsed = new URL(val);
          if (
            parsed.hostname.includes('trycloudflare.com') ||
            parsed.hostname.includes('ngrok') ||
            parsed.hostname.includes('loca.lt')
          ) {
            return parsed.origin;
          }
        }
        const matchAppUrl = content.match(/^APP_URL=(.+)$/m);
        if (matchAppUrl && matchAppUrl[1]) {
          const val = matchAppUrl[1].trim().replace(/^['"]+|['"]+$/g, '');
          if (val) return val.replace(/\/+$/, '');
        }
      }
    } catch {
      // Ignore reading error
    }

    // 2. Thử lấy từ cấu hình Zalo Webhook
    const webhookUrl = this.configService.get<string>('zalo.webhookUrl') || '';
    if (webhookUrl) {
      try {
        const parsed = new URL(webhookUrl);
        if (
          parsed.hostname.includes('trycloudflare.com') ||
          parsed.hostname.includes('ngrok') ||
          parsed.hostname.includes('loca.lt')
        ) {
          return parsed.origin;
        }
      } catch {
        // Ignore parsing error
      }
    }

    return (this.configService.get<string>('appUrl') || '').replace(/\/+$/, '');
  }

  public async execute(context: TextToolContext): Promise<void> {
    const appUrl = this.resolveAppUrl();

    try {
      const { token, code } = await this.reportsTokens.issueExchangeToken(context.senderId);
      const accessUrl = `${appUrl}${API_ROUTES.access}?token=${encodeURIComponent(token)}`;

      const reply =
        `📊 BẢNG ĐIỀU KHIỂN TRỰC QUAN (WEB DASHBOARD)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Xem biểu đồ Thu–Chi, Danh sách Việc, Lịch Google, Nhắc việc & Công nợ tại:\n\n` +
        `👉 ${accessUrl}\n\n` +
        `🔑 Mã đăng nhập trong ứng dụng đã cài: ${formatDashboardAccessCode(code)}\n\n` +
        `🔒 Đường dẫn và mã chỉ dùng được một lần, có hạn trong 20 phút. Vui lòng không chia sẻ cho người khác.`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to generate dashboard link: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Chưa thể tạo đường dẫn Dashboard. Vui lòng kiểm tra lại cấu hình hệ thống.',
      );
    }
  }
}
