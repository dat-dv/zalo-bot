import {
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThreadBotConfig } from '@zalobot/contracts';
import { OutgoingMemoryKind } from './memory/memory-kind';
import { buildListenAnnouncement } from './listen-announcement';
import { ThreadConfigService } from './thread-config.service';
import { ZcaMessengerService } from './zca-messenger.service';

/** A chat switched on again within this long is not announced twice (admin toggling). */
export const LISTEN_ANNOUNCE_COOLDOWN_MS = 10 * 60 * 1000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/**
 * Posts `buildListenAnnouncement` into a chat when the bot starts listening to it (from any path:
 * thread config page, quick toggle, bulk selection; see `ThreadConfigService.onListenStarted`).
 * Sent as a `system` message, so it never reaches the chat memory. Never throws: a failed send
 * (ZCA logged out) is only logged.
 */
@Injectable()
export class ListenAnnouncementService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ListenAnnouncementService.name);
  private readonly lastAnnouncedAt = new Map<string, number>();
  private unsubscribe?: () => void;

  constructor(
    private readonly threadConfigService: ThreadConfigService,
    private readonly messenger: ZcaMessengerService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  public onApplicationBootstrap(): void {
    this.unsubscribe = this.threadConfigService.onListenStarted((config) => {
      void this.announce(config);
    });
  }

  public onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /** `true` when the message was sent; `false` when skipped (cooldown) or the send failed. */
  public async announce(config: ThreadBotConfig, now: number = Date.now()): Promise<boolean> {
    const threadId = config.threadId;
    const last = this.lastAnnouncedAt.get(threadId);
    if (last !== undefined && now - last < LISTEN_ANNOUNCE_COOLDOWN_MS) return false;
    this.lastAnnouncedAt.set(threadId, now);
    const botName =
      this.configService?.get<string>('zalo.botName') || process.env.BOT_NAME || 'Bot';
    try {
      const sent = await OutgoingMemoryKind.run('system', () =>
        this.messenger.sendMessage(threadId, buildListenAnnouncement(config, botName)),
      );
      if (!sent) {
        this.logger.warn(`[ListenAnnouncement] Could not post the listen notice in ${threadId}`);
      }
      return sent;
    } catch (err: unknown) {
      this.logger.warn(
        `[ListenAnnouncement] Listen notice failed in ${threadId}: ${errorMessage(err)}`,
      );
      return false;
    }
  }
}
