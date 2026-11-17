import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import { AuditContext } from '../../../audit/audit-context';
import { throttledErrorLogger } from '../../../queue/reminder-queue';
import { ZcaMessengerService } from '../../zca-messenger.service';
import {
  CHAT_MEMORY_EMBED_JOB,
  CHAT_MEMORY_NIGHTLY_CRON,
  CHAT_MEMORY_NIGHTLY_JOB,
  CHAT_MEMORY_QUEUE,
  CHAT_MEMORY_SYNC_JOB,
  LEGACY_CHAT_MEMORY_SEGMENT_JOB,
  readChannelJob,
} from './memory-embedding.jobs';
import { MemoryEmbeddingService, type MemorySyncResult } from './memory-embedding.service';

export { CHAT_MEMORY_QUEUE };

/** The `/sync` answer posted to the chat once the job is done. */
export function syncResultText(result: MemorySyncResult | null): string {
  if (!result) return '🧠 Kênh này chưa bật Nhớ lâu dài nên không có gì để cập nhật.';
  if (result.unavailable) {
    return '⚠️ Bộ nhớ theo ý nghĩa chưa sẵn sàng (chưa nạp được model), bot vẫn tìm lại tin theo từ khoá. Thử lại sau ít phút.';
  }
  return result.embedded > 0
    ? `🧠 Đã cập nhật trí nhớ: ${result.embedded} tin mới.`
    : '🧠 Trí nhớ đã đủ, không có tin mới.';
}

const NIGHTLY_JOB_OPTIONS = { removeOnComplete: true, removeOnFail: { count: 20 } } as const;

/**
 * Runs the memory jobs one at a time: the nightly sweep over every chat, new messages of one chat,
 * and `/sync` (whose result is posted to the chat).
 */
@Processor(CHAT_MEMORY_QUEUE, { concurrency: 1 })
export class MemoryEmbeddingProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MemoryEmbeddingProcessor.name);
  private readonly logConnectionError = throttledErrorLogger(this.logger, 'Chat memory queue');

  constructor(
    private readonly embedding: MemoryEmbeddingService,
    @InjectQueue(CHAT_MEMORY_QUEUE) private readonly queue: Queue,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly messenger?: ZcaMessengerService,
  ) {
    super();
  }

  public onApplicationBootstrap(): void {
    this.queue.on('error', this.logConnectionError);
    const tz = this.configService?.get<string>('timezone') || 'Asia/Ho_Chi_Minh';
    // Upserting keeps one schedule across restarts and instances; not awaited (Redis may be down).
    void this.queue
      .upsertJobScheduler(
        CHAT_MEMORY_NIGHTLY_JOB,
        { pattern: CHAT_MEMORY_NIGHTLY_CRON, tz },
        { name: CHAT_MEMORY_NIGHTLY_JOB, opts: NIGHTLY_JOB_OPTIONS },
      )
      .catch((err: unknown) => {
        this.logger.error(
          `Could not schedule the chat memory job: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      });
  }

  public async process(job: Job<unknown>): Promise<void> {
    // The jobs act for nobody: rows they write are system changes.
    if (job.name === CHAT_MEMORY_NIGHTLY_JOB) {
      await AuditContext.runAsSystem(() => this.embedding.runNightly());
      return;
    }
    const data = readChannelJob(job.data);
    if (job.name === CHAT_MEMORY_EMBED_JOB || job.name === LEGACY_CHAT_MEMORY_SEGMENT_JOB) {
      if (data) await AuditContext.runAsSystem(() => this.embedding.runChannel(data.channelId));
      return;
    }
    if (job.name === CHAT_MEMORY_SYNC_JOB && data) {
      const result = await AuditContext.runAsSystem(() =>
        this.embedding.runChannel(data.channelId),
      );
      await this.messenger?.sendMessage(data.channelId, syncResultText(result));
      return;
    }
    throw new Error(`Unknown chat memory job "${job.name}"`);
  }

  @OnWorkerEvent('failed')
  public onFailed(job: Job<unknown> | undefined, err: Error): void {
    this.logger.error(`Chat memory job ${job?.id ?? ''} failed: ${err.message}`);
  }

  @OnWorkerEvent('error')
  public onError(err: Error): void {
    this.logConnectionError(err);
  }
}
