import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AuditContext } from '../../audit/audit-context';
import type { RecurringOccurrenceEntity } from '../../database/entities/recurring-occurrence.entity';
import { RecurringTransactionService } from '../../finance/recurring/recurring-transaction.service';
import { throttledErrorLogger } from '../../queue/reminder-queue';
import { ZcaMessengerService } from '../zca-messenger.service';

export const RECURRING_QUEUE = 'recurring-transactions';
const RECURRING_SCAN_JOB = 'scan';
const RECURRING_SCAN_EVERY_MS = 5 * 60_000;

const money = (amount: number): string => `${amount.toLocaleString('vi-VN')}đ`;

/** The chat message of a period; a `due` one says how to record it, since no card waits for it. */
export function recurringNotice(occurrence: RecurringOccurrenceEntity): string {
  const note = occurrence.rule?.note ?? '';
  if (occurrence.status === 'recorded') {
    return `🔁 Đã tự ghi ${note} ${money(occurrence.amount ?? 0)}. Sai thì xoá hoặc sửa như giao dịch thường.`;
  }
  const amount = occurrence.amount ? ` (dự kiến ${money(occurrence.amount)})` : '';
  return `🔁 Đến kỳ ${note}${amount}. Nhắn "đã đóng ${note} <số tiền>" hoặc "bỏ qua ${note}" để bot ghi nhận.`;
}

/** Turns due rules into periods, then tells each rule's chat. A send that fails waits for the next scan. */
@Processor(RECURRING_QUEUE, { concurrency: 1 })
export class RecurringScanProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecurringScanProcessor.name);
  private readonly logConnectionError = throttledErrorLogger(this.logger, 'Recurring queue');

  constructor(
    private readonly recurring: RecurringTransactionService,
    private readonly messenger: ZcaMessengerService,
    @InjectQueue(RECURRING_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  public onApplicationBootstrap(): void {
    this.queue.on('error', this.logConnectionError);
    // Upserting keeps one schedule across restarts; not awaited because Redis may be down.
    void this.queue
      .upsertJobScheduler(
        RECURRING_SCAN_JOB,
        { every: RECURRING_SCAN_EVERY_MS },
        { name: RECURRING_SCAN_JOB, opts: { removeOnComplete: true, removeOnFail: { count: 20 } } },
      )
      .catch((err: unknown) => {
        this.logger.error(
          `Could not schedule the recurring scan: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      });
  }

  public async process(job: Job<unknown>): Promise<void> {
    if (job.name !== RECURRING_SCAN_JOB) throw new Error(`Unknown recurring job "${job.name}"`);
    // Recording does not need Zalo: the ledger must stay right while the bot is offline.
    await AuditContext.runAsSystem(() => this.recurring.processDue());
    if (this.messenger.isConnected()) await this.notify();
  }

  public async notify(): Promise<void> {
    for (const occurrence of await this.recurring.listUnnotified()) {
      const chatId = occurrence.rule?.notifyChatId;
      const sent = chatId
        ? await this.messenger.sendMessage(chatId, recurringNotice(occurrence))
        : true;
      if (sent) await this.recurring.markNotified(occurrence.id);
    }
  }

  @OnWorkerEvent('failed')
  public onFailed(job: Job<unknown> | undefined, err: Error): void {
    this.logger.error(`Recurring job ${job?.id ?? ''} failed: ${err.message}`);
  }

  @OnWorkerEvent('error')
  public onError(err: Error): void {
    this.logConnectionError(err);
  }
}
