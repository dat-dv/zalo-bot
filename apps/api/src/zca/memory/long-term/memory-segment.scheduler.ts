import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ThreadConfigService } from '../../thread-config.service';
import {
  CHAT_MEMORY_QUEUE,
  CHAT_MEMORY_SEGMENT_JOB,
  CHAT_MEMORY_SYNC_JOB,
  type SegmentJobData,
  type SyncJobData,
} from './memory-ingest.jobs';

/** The chat is quiet for this long, then its new messages go to Cognee. */
export const SEGMENT_IDLE_MS = 3 * 60 * 1000;
/** A chat that never goes quiet is still sent this long after the first unsent message. */
export const SEGMENT_MAX_WAIT_MS = 15 * 60 * 1000;
/** After a restart every chat with long-term memory is sent once, for timers lost with it. */
export const SEGMENT_CATCH_UP_DELAY_MS = 60 * 1000;

const JOB_OPTIONS = { removeOnComplete: true, removeOnFail: { count: 20 } } as const;

/**
 * When today's new messages of a chat go to Cognee: each message pushes the chat's timer back
 * by `SEGMENT_IDLE_MS`, capped at `SEGMENT_MAX_WAIT_MS` after the first one; then a `segment` job
 * joins the `chat-memory` queue (one job at a time, so it never runs beside the nightly job). The
 * timers live in this process; a restart loses them, so every chat is sent once after boot. A
 * segment only takes messages after the last one sent, so an extra job sends nothing twice.
 */
@Injectable()
export class MemorySegmentScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MemorySegmentScheduler.name);
  private readonly pending = new Map<string, { timer: NodeJS.Timeout; firstAt: number }>();
  private catchUpTimer?: NodeJS.Timeout;

  constructor(
    @InjectQueue(CHAT_MEMORY_QUEUE) private readonly queue: Queue,
    private readonly threadConfigService: ThreadConfigService,
  ) {}

  public onApplicationBootstrap(): void {
    this.catchUpTimer = setTimeout(() => {
      for (const config of this.threadConfigService.getAllConfigs()) {
        if (config.isListened && config.chatMemory?.enabled) {
          void this.enqueueSegment({ channelId: config.threadId });
        }
      }
    }, SEGMENT_CATCH_UP_DELAY_MS);
    this.catchUpTimer.unref?.();
  }

  public onModuleDestroy(): void {
    if (this.catchUpTimer) clearTimeout(this.catchUpTimer);
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  /** A message of a chat with long-term memory was stored. */
  public noteMessage(channelId: string, now: number = Date.now()): void {
    const current = this.pending.get(channelId);
    const firstAt = current?.firstAt ?? now;
    if (current) clearTimeout(current.timer);
    const delay = Math.max(0, Math.min(SEGMENT_IDLE_MS, firstAt + SEGMENT_MAX_WAIT_MS - now));
    const timer = setTimeout(() => {
      this.pending.delete(channelId);
      void this.enqueueSegment({ channelId });
    }, delay);
    timer.unref?.();
    this.pending.set(channelId, { timer, firstAt });
  }

  /** A message of today was recalled: today is sent again without it, at once. */
  public noteRecall(channelId: string): void {
    this.cancel(channelId);
    void this.enqueueSegment({ channelId, resetToday: true });
  }

  /** `/sync`: past pending days and today's new messages at once; the result is posted to the chat. */
  public async requestSync(data: SyncJobData): Promise<boolean> {
    this.cancel(data.channelId);
    try {
      await this.queue.add(CHAT_MEMORY_SYNC_JOB, data, JOB_OPTIONS);
      return true;
    } catch (err: unknown) {
      this.logger.warn(`[MemorySegment] Could not queue /sync: ${errorMessage(err)}`);
      return false;
    }
  }

  private cancel(channelId: string): void {
    const current = this.pending.get(channelId);
    if (current) clearTimeout(current.timer);
    this.pending.delete(channelId);
  }

  private async enqueueSegment(data: SegmentJobData): Promise<void> {
    try {
      await this.queue.add(CHAT_MEMORY_SEGMENT_JOB, data, JOB_OPTIONS);
    } catch (err: unknown) {
      // Redis down: the nightly job still sends the whole day.
      this.logger.warn(`[MemorySegment] Could not queue a segment: ${errorMessage(err)}`);
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}
