import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { ReportsTokenService } from '../../../reports/reports-token.service';

@Injectable()
export class DashboardToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.DASHBOARD;
  private readonly logger = new Logger(DashboardToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly configService: ConfigService,
    private readonly reportsTokens: ReportsTokenService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const appUrl = (this.configService.get<string>('appUrl') || '').replace(/\/+$/, '');

    try {
      const token = await this.reportsTokens.issueExchangeToken(context.senderId);
      const accessUrl = `${appUrl}/api/access?token=${encodeURIComponent(token)}`;

      const reply =
        `📊 BẢNG ĐIỀU KHIỂN TRỰC QUAN (WEB DASHBOARD)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Xem biểu đồ Thu–Chi, Danh sách Việc, Lịch Google, Nhắc việc & Công nợ tại:\n\n` +
        `👉 ${accessUrl}\n\n` +
        `🔒 Đường dẫn đăng nhập một lần, bảo mật và có hạn trong 20 phút. Vui lòng không chia sẻ cho người khác.`;

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
