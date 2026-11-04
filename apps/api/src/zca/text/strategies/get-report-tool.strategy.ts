import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { FinanceService } from '../../../finance/finance.service';
import {
  FinanceReportService,
  type FinanceBreakdown,
  type FinanceBreakdownFilter,
} from '../../../finance/finance-report.service';
import {
  isReportPeriod,
  resolveReportPeriod,
  resolveReportRange,
  type ReportRange,
} from '../../../finance/report-period';
import { cleanToolArguments } from '../../../llm/utils/tool-arguments.util';

const money = (amount: number): string => `${amount.toLocaleString('vi-VN')}đ`;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Says the period and filters out loud, so a wrong guess by the model is visible in the answer. */
export function formatFinanceReport(input: {
  range: ReportRange;
  filters: readonly string[];
  breakdown: FinanceBreakdown;
  walletBalance: number;
}): string {
  const { range, filters, breakdown, walletBalance } = input;
  const heading = [range.label, ...filters].join(' · ');
  if (breakdown.count === 0) return `📊 ${heading}: không có giao dịch nào.`;

  const lines = [`📊 ${heading}`];
  lines.push(
    `Thu ${money(breakdown.income)} · Chi ${money(breakdown.expense)} (${breakdown.count} giao dịch)`,
  );
  if (breakdown.topCategories.length > 1) {
    const top = breakdown.topCategories.map((row) => `${row.category} ${money(row.amount)}`);
    lines.push(`Nhiều nhất: ${top.join(', ')}`);
  }
  if (filters.length > 0 && breakdown.topTransactions.length > 0) {
    const top = breakdown.topTransactions.map((row) => `${row.note} ${money(row.amount)}`);
    lines.push(`Lớn nhất: ${top.join(', ')}`);
  }
  if (filters.length === 0) lines.push(`Số dư hiện tại ${money(walletBalance)}`);
  return lines.join('\n');
}

@Injectable()
export class GetReportToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.GET_REPORT;
  private readonly logger = new Logger(GetReportToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly financeService: FinanceService,
    private readonly financeReport: FinanceReportService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    try {
      const args = cleanToolArguments(context.toolArgs || {});
      const reply = await this.buildReply(args);
      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to get report: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa lấy được báo cáo, thử lại sau.');
    }
  }

  private resolveRange(args: Record<string, unknown>): ReportRange | null {
    const startDate = text(args.startDate);
    const endDate = text(args.endDate);
    if (startDate || endDate)
      return resolveReportRange(startDate ?? '', endDate ?? startDate ?? '');
    return resolveReportPeriod(
      isReportPeriod(args.period) ? args.period : 'this_month',
      new Date(),
    );
  }

  private async buildReply(args: Record<string, unknown>): Promise<string> {
    const range = this.resolveRange(args);
    if (!range) return '⚠️ Khoảng ngày không hợp lệ, nhắn lại giúp mình nhé.';

    const filter: FinanceBreakdownFilter = { startAt: range.startAt, endAt: range.endAt };
    const filters: string[] = [];

    if (args.type === 'income' || args.type === 'expense') {
      filter.type = args.type;
      filters.push(args.type === 'income' ? 'khoản thu' : 'khoản chi');
    }
    const category = text(args.category);
    if (category) {
      filter.category = category;
      filters.push(`danh mục ${category}`);
    }
    const keyword = text(args.keyword);
    if (keyword) {
      filter.keyword = keyword;
      filters.push(`có "${keyword}"`);
    }
    // Names resolve exactly: answering for a different person or place is worse than no answer.
    const placeName = text(args.placeName);
    if (placeName) {
      const places = await this.financeService.resolvePlaces(placeName);
      if (!places.length) return `Không tìm thấy nơi chốn "${placeName}".`;
      filter.placeIds = places.map((place) => place.id);
      filters.push(`tại ${placeName}`);
    }
    const contactName = text(args.contactName);
    if (contactName) {
      const contacts = await this.financeService.resolveContacts(contactName);
      if (!contacts.length) return `Không tìm thấy người liên quan "${contactName}".`;
      filter.contactIds = contacts.map((contact) => contact.id);
      filters.push(`với ${contactName}`);
    }

    const [breakdown, walletBalance] = await Promise.all([
      this.financeReport.getBreakdown(filter),
      this.financeService.getLedgerBalance(),
    ]);
    return formatFinanceReport({ range, filters, breakdown, walletBalance });
  }
}
