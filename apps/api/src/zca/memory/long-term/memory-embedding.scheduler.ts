import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ChatMemoryService } from '../chat-memory.service';
import {
  CHAT_MEMORY_EMBED_JOB,
  CHAT_MEMORY_NIGHTLY_JOB,
  CHAT_MEMORY_QUEUE,
  CHAT_MEMORY_SYNC_JOB,
  type ChannelJobData,
} from './memory-embedding.jobs';

/** A chat's new messages are embedded once it is quiet for this long… */
export const EMBED_IDLE_MS = 20 * 1000;
/** …or this long after the first one, when it never goes quiet. */
export const EMBED_MAX_WAIT_MS = 2 * 60 * 1000;
/** After a restart every chat is swept once (timers lost with it, backfill of old messages). */
export const EMBED_CATCH_UP_DELAY_MS = 60 * 1000;

const JOB_OPTIONS = { removeOnComplete: true, removeOnFail: { count: 20 } } as const;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/**
 * When a chat's new messages are embedded: every change of the chat memory (stored, recalled,
 * photo text read) pushes the chat's timer back by `EMBED_IDLE_MS`, capped at `EMBED_MAX_WAIT_MS`
 * after the first change; then an `embed` job joins the `chat-memory` queue (one job at a time).
 * Timers live in this process; the sweep after boot and the nightly job pick up what a restart
 * lost. An extra job only embeds what still has no embedding.
 */
@Injectable()
export class MemoryEmbeddingScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MemoryEmbeddingScheduler.name);
  private readonly pending = new Map<string, { timer: NodeJS.Timeout; firstAt: number }>();
  private catchUpTimer?: NodeJS.Timeout;
  private unsubscribe?: () => void;

  constructor(
    @InjectQueue(CHAT_MEMORY_QUEUE) private readonly queue: Queue,
    private readonly chatMemory: ChatMemoryService,
  ) {}

  public onApplicationBootstrap(): void {
    this.unsubscribe = this.chatMemory.onChange((channelId) => this.noteChange(channelId));
    this.catchUpTimer = setTimeout(() => {
      void this.enqueue(CHAT_MEMORY_NIGHTLY_JOB, {});
    }, EMBED_CATCH_UP_DELAY_MS);
    this.catchUpTimer.unref?.();
  }

  public onModuleDestroy(): void {
    this.unsubscribe?.();
    if (this.catchUpTimer) clearTimeout(this.catchUpTimer);
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  /** The memory of a chat changed. */
  public noteChange(channelId: string, now: number = Date.now()): void {
    const current = this.pending.get(channelId);
    const firstAt = current?.firstAt ?? now;
    if (current) clearTimeout(current.timer);
    const delay = Math.max(0, Math.min(EMBED_IDLE_MS, firstAt + EMBED_MAX_WAIT_MS - now));
    const timer = setTimeout(() => {
      this.pending.delete(channelId);
      void this.enqueue(CHAT_MEMORY_EMBED_JOB, { channelId });
    }, delay);
    timer.unref?.();
    this.pending.set(channelId, { timer, firstAt });
  }

  /** `/sync`: the chat's new messages at once; the result is posted to the chat. */
  public async requestSync(data: ChannelJobData): Promise<boolean> {
    const current = this.pending.get(data.channelId);
    if (current) clearTimeout(current.timer);
    this.pending.delete(data.channelId);
    return this.enqueue(CHAT_MEMORY_SYNC_JOB, data);
  }

  private async enqueue(
    name: string,
    data: ChannelJobData | Record<string, never>,
  ): Promise<boolean> {
    try {
      await this.queue.add(name, data, JOB_OPTIONS);
      return true;
    } catch (err: unknown) {
      // Redis down: the nightly job still embeds everything.
      this.logger.warn(`[MemoryEmbedding] Could not queue ${name}: ${errorMessage(err)}`);
      return false;
    }
  }
}
