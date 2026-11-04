import { Injectable, Logger, Optional } from '@nestjs/common';
import { FinanceReportService } from '../../finance/finance-report.service';
import { FinanceService } from '../../finance/finance.service';
import { resolveReportPeriod, type ReportRange } from '../../finance/report-period';
import { RedisService } from '../../redis/redis.service';
import { ThreadConfigService } from '../thread-config.service';
import { ZcaMessengerService } from '../zca-messenger.service';
import type { FinanceDigestKind } from './finance-digest.jobs';
import { formatFinanceDigest } from './finance-digest.format';

const DAY_MS = 24 * 60 * 60_000;
/** Longer than any retry window; the key only has to outlive a job's attempts. */
const SENT_MARK_TTL_SECONDS = 3 * 24 * 60 * 60;

/** The finished period and the one before it, for the comparison. */
export function digestRanges(
  kind: FinanceDigestKind,
  now: Date,
): { current: ReportRange; previous: ReportRange } {
  if (kind === 'weekly') {
    return {
      current: resolveReportPeriod('last_week', now),
      previous: resolveReportPeriod('last_week', new Date(now.getTime() - 7 * DAY_MS)),
    };
  }
  const current = resolveReportPeriod('last_month', now);
  // Any moment inside last month works; its `last_month` is the month before.
  const previous = resolveReportPeriod('last_month', current.startAt ?? now);
  return { current, previous };
}

@Injectable()
export class FinanceDigestService {
  private readonly logger = new Logger(FinanceDigestService.name);

  constructor(
    private readonly financeReport: FinanceReportService,
    private readonly finance: FinanceService,
    private readonly threadConfig: ThreadConfigService,
    private readonly messenger: ZcaMessengerService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  public async buildText(kind: FinanceDigestKind, now: Date): Promise<string> {
    const { current, previous } = digestRanges(kind, now);
    const [currentBreakdown, previousBreakdown, debts] = await Promise.all([
      this.financeReport.getBreakdown({ startAt: current.startAt, endAt: current.endAt }),
      this.financeReport.getBreakdown({ startAt: previous.startAt, endAt: previous.endAt }),
      this.finance.getActiveDebts(),
    ]);
    return formatFinanceDigest({
      label: current.label,
      current: currentBreakdown,
      previous: previousBreakdown,
      debts,
      now,
    });
  }

  /**
   * Sends to every listened channel that opted in. Throws when any channel failed so BullMQ retries;
   * the sent marks keep a retry from repeating the channels that already got theirs.
   */
  public async run(kind: FinanceDigestKind, now: Date = new Date()): Promise<number> {
    const channels: string[] = [];
    for (const threadId of this.threadConfig.getListenedThreadIds()) {
      const config = await this.threadConfig.getConfig(threadId);
      if (config.financeDigest?.[kind]) channels.push(threadId);
    }
    if (channels.length === 0) return 0;
    if (!this.messenger.isConnected()) throw new Error('ZCA is not connected');

    const { current } = digestRanges(kind, now);
    const periodKey = current.startAt?.toISOString() ?? 'all';
    const text = await this.buildText(kind, now);

    let sent = 0;
    let failed = 0;
    for (const channelId of channels) {
      const markKey = `finance-digest:sent:${kind}:${periodKey}:${channelId}`;
      if (await this.redis?.get(markKey)) continue;
      if (await this.messenger.sendMessage(channelId, text)) {
        await this.redis?.set(markKey, '1', SENT_MARK_TTL_SECONDS);
        sent += 1;
      } else {
        failed += 1;
        this.logger.warn(`Finance digest (${kind}) could not reach ${channelId}`);
      }
    }
    if (failed > 0) throw new Error(`${failed} channel(s) missed the ${kind} digest`);
    return sent;
  }
}
