import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
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
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly configService: ConfigService,
    private readonly reportsTokens: ReportsTokenService,
  ) {}

  private resolveAppUrl(): string {
    // 1. Thử đọc URL từ file .env để bắt kịp tunnel vừa khởi động (không cần restart server)
    try {
      const envPath = fromProjectRoot('.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const matchAppUrl = content.match(/^APP_URL=(.+)$/m);
        if (matchAppUrl && matchAppUrl[1]) {
          const val = matchAppUrl[1].trim().replace(/^['"]+|['"]+$/g, '');
          if (val) return val.replace(/\/+$/, '');
        }
      }
    } catch {
      // Ignore reading error
    }

    return (this.configService.get<string>('appUrl') || '').replace(/\/+$/, '');
  }

  public async execute(context: TextToolContext): Promise<void> {
    const appUrl = this.resolveAppUrl();

    try {
      const { token, code } = await this.reportsTokens.issueExchangeToken(context.senderId);
      const accessUrl = `${appUrl}${API_ROUTES.access}?token=${encodeURIComponent(token)}`;

      const reply =
        `Dashboard: ${accessUrl}\n` +
        `Mã đăng nhập app: ${formatDashboardAccessCode(code)}\n` +
        `Link và mã chỉ dùng 1 lần, hết hạn sau 20 phút. Đừng chia sẻ.`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to generate dashboard link: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa tạo được link dashboard. Kiểm tra lại cấu hình hệ thống.',
      );
    }
  }
}
