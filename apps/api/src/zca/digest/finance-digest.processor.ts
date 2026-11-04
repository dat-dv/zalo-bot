import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import { throttledErrorLogger } from '../../queue/reminder-queue';
import {
  FINANCE_DIGEST_CRON,
  FINANCE_DIGEST_JOB_OPTIONS,
  FINANCE_DIGEST_KINDS,
  FINANCE_DIGEST_QUEUE,
  isFinanceDigestKind,
} from './finance-digest.jobs';
import { FinanceDigestService } from './finance-digest.service';

@Processor(FINANCE_DIGEST_QUEUE, { concurrency: 1 })
export class FinanceDigestProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(FinanceDigestProcessor.name);
  private readonly logConnectionError = throttledErrorLogger(this.logger, 'Finance digest queue');

  constructor(
    private readonly digest: FinanceDigestService,
    @InjectQueue(FINANCE_DIGEST_QUEUE) private readonly queue: Queue,
    @Optional() private readonly configService?: ConfigService,
  ) {
    super();
  }

  public onApplicationBootstrap(): void {
    this.queue.on('error', this.logConnectionError);
    const tz = this.configService?.get<string>('timezone') || 'Asia/Ho_Chi_Minh';
    // Upserting keeps one schedule across restarts; not awaited because Redis may be down.
    for (const kind of FINANCE_DIGEST_KINDS) {
      void this.queue
        .upsertJobScheduler(
          `finance-digest-${kind}`,
          { pattern: FINANCE_DIGEST_CRON[kind], tz },
          { name: kind, opts: FINANCE_DIGEST_JOB_OPTIONS },
        )
        .catch((err: unknown) => {
          this.logger.error(
            `Could not schedule the ${kind} digest: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
        });
    }
  }

  public async process(job: Job<unknown>): Promise<void> {
    if (!isFinanceDigestKind(job.name)) throw new Error(`Unknown digest job "${job.name}"`);
    // A retry hours later still means the period of the original run.
    const sent = await this.digest.run(job.name, new Date(job.timestamp));
    this.logger.log(`Finance digest (${job.name}) sent to ${sent} channel(s).`);
  }

  @OnWorkerEvent('failed')
  public onFailed(job: Job<unknown> | undefined, err: Error): void {
    this.logger.error(`Finance digest job ${job?.id ?? ''} failed: ${err.message}`);
  }

  @OnWorkerEvent('error')
  public onError(err: Error): void {
    this.logConnectionError(err);
  }
}
