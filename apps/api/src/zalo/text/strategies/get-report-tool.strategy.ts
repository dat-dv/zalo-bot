import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { FinanceService } from '../../../finance/finance.service';

@Injectable()
export class GetReportToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.GET_REPORT;
  private readonly logger = new Logger(GetReportToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly financeService: FinanceService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const summary = await this.financeService.getSummary(Number(context.senderId) || 1);

      const reply =
        `📊 BÁO CÁO TÀI CHÍNH CỦA BẠN:\n\n` +
        `• Tổng thu: ${summary.income.toLocaleString('vi-VN')} đ\n` +
        `• Tổng chi: ${summary.expense.toLocaleString('vi-VN')} đ\n` +
        `• Số dư hiện tại: ${summary.balance.toLocaleString('vi-VN')} đ\n\n` +
        `💡 Bạn có thể tra cứu chi tiết hơn tại giao diện Dashboard web!`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to get report summary: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không thể lấy dữ liệu báo cáo lúc này.',
      );
    }
  }
}
