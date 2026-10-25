import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import { AuditContext } from '../../../audit/audit-context';
import { throttledErrorLogger } from '../../../queue/reminder-queue';
import { MemoryIngestService } from './memory-ingest.service';

/** BullMQ queue of the nightly long-term memory job. */
export const CHAT_MEMORY_QUEUE = 'chat-memory';
export const CHAT_MEMORY_NIGHTLY_JOB = 'nightly';
/** 03:00 in the bot timezone: the chat day before is over and chats are quiet. */
export const CHAT_MEMORY_NIGHTLY_CRON = '0 3 * * *';

const NIGHTLY_JOB_OPTIONS = {
  removeOnComplete: true,
  removeOnFail: { count: 20 },
} as const;

/** Runs the nightly memory job; one at a time, each night's run handles every chat in turn. */
@Processor(CHAT_MEMORY_QUEUE, { concurrency: 1 })
export class MemoryIngestProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MemoryIngestProcessor.name);
  private readonly logConnectionError = throttledErrorLogger(this.logger, 'Chat memory queue');

  constructor(
    private readonly ingest: MemoryIngestService,
    @InjectQueue(CHAT_MEMORY_QUEUE) private readonly queue: Queue,
    @Optional() private readonly configService?: ConfigService,
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
    if (job.name !== CHAT_MEMORY_NIGHTLY_JOB) {
      throw new Error(`Unknown chat memory job "${job.name}"`);
    }
    // The job acts for nobody: rows it writes are system changes.
    await AuditContext.runAsSystem(() => this.ingest.runNightly());
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
