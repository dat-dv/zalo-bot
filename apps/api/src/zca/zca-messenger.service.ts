import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ZcaService } from './zca.service';
import { splitMessage } from '../common/utils/message-splitter.util';

export type ChatAction = 'typing' | 'upload_photo';

/** Long replies go out as several messages of at most this many characters. */
const MESSAGE_CHUNK_LENGTH = 1900;
const CHUNK_DELAY_MS = 300;

/**
 * Outgoing chat messages for the bot's tools and services. Every message goes through the
 * personal ZCA account; when ZCA is not logged in, sends fail softly (`success: false`).
 */
@Injectable()
export class ZcaMessengerService {
  private readonly logger = new Logger(ZcaMessengerService.name);

  constructor(
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ZcaService,
  ) {}

  public async sendMessageWithResult(
    chatId: string | number,
    text: string,
  ): Promise<{ success: boolean; msgId?: string; cliMsgId?: string }> {
    const targetChatId = String(chatId);

    if (!this.zcaService?.isLoggedIn()) {
      this.logger.warn(`ZCA is not logged in. Outgoing message to ${targetChatId}: "${text}"`);
      return { success: false };
    }

    const chunks = splitMessage(text, MESSAGE_CHUNK_LENGTH);
    if (chunks.length === 0) {
      return { success: true };
    }

    let lastResult: { success: boolean; msgId?: string; cliMsgId?: string } = { success: false };
    for (let i = 0; i < chunks.length; i++) {
      lastResult = await this.sendSingleMessage(this.zcaService, targetChatId, chunks[i]);
      if (!lastResult.success) {
        return lastResult;
      }
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      }
    }
    return lastResult;
  }

  private async sendSingleMessage(
    zcaService: ZcaService,
    targetChatId: string,
    text: string,
  ): Promise<{ success: boolean; msgId?: string; cliMsgId?: string }> {
    try {
      const res = await zcaService.sendMessage(text, targetChatId);
      const rawMsg = res?.message as unknown as
        { msgId?: string | number; cliMsgId?: string | number } | undefined;
      const msgId = rawMsg?.msgId !== undefined ? String(rawMsg.msgId) : undefined;
      const cliMsgId = rawMsg?.cliMsgId !== undefined ? String(rawMsg.cliMsgId) : undefined;
      this.logger.log(
        `Successfully sent message via ZCA to chat ${targetChatId}${msgId ? ` (msgId: ${msgId}, cliMsgId: ${cliMsgId || 'n/a'})` : ''}`,
      );
      return { success: true, msgId, cliMsgId };
    } catch (zcaErr) {
      this.logger.error(
        `Failed to send message via ZCA to ${targetChatId}: ${zcaErr instanceof Error ? zcaErr.message : String(zcaErr)}`,
      );
      return { success: false };
    }
  }

  /**
   * Recalls / undoes a previously sent message for everyone in the chat (ZCA).
   * Safe method: never throws error, logs warnings and returns boolean status.
   */
  public async undoMessage(
    chatId: string | number,
    msgId: string,
    cliMsgId?: string,
  ): Promise<boolean> {
    const targetChatId = String(chatId);
    if (!this.zcaService?.isLoggedIn()) {
      this.logger.debug(`Cannot recall message ${msgId}: ZCA is not logged in.`);
      return false;
    }

    let resolvedCliMsgId = cliMsgId;
    if (!resolvedCliMsgId || resolvedCliMsgId === msgId) {
      resolvedCliMsgId = await this.zcaService.getCliMsgId(msgId);
    }

    try {
      await this.zcaService.undo(
        {
          msgId,
          cliMsgId: resolvedCliMsgId || msgId,
        },
        targetChatId,
      );
      this.logger.log(`Successfully recalled message ${msgId} in chat ${targetChatId}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Failed to recall message ${msgId} in chat ${targetChatId}: ${(err as Error).message}`,
      );
      // Fallback: Delete on bot side via deleteMessage (onlyMe=true)
      try {
        await this.zcaService.deleteMessage(
          {
            data: {
              msgId,
              cliMsgId: resolvedCliMsgId || msgId,
              uidFrom: this.zcaService.getOwnId() || '0',
            },
            threadId: targetChatId,
          },
          true,
        );
        this.logger.log(`Fallback deleted message ${msgId} (onlyMe) in chat ${targetChatId}`);
      } catch {
        // Silently ignore fallback error
      }
      return false;
    }
  }

  /**
   * Deletes a message via ZCA.
   * - onlyMe: true (default) -> deletes message only for bot side
   * - onlyMe: false -> deletes message for everyone (only works if bot is group admin)
   */
  public async deleteMessage(
    chatId: string | number,
    msgId: string,
    cliMsgId?: string,
    onlyMe = true,
  ): Promise<boolean> {
    const targetChatId = String(chatId);
    if (!this.zcaService?.isLoggedIn()) {
      return false;
    }

    let resolvedCliMsgId = cliMsgId;
    if (!resolvedCliMsgId || resolvedCliMsgId === msgId) {
      resolvedCliMsgId = await this.zcaService.getCliMsgId(msgId);
    }

    try {
      await this.zcaService.deleteMessage(
        {
          data: {
            msgId,
            cliMsgId: resolvedCliMsgId || msgId,
            uidFrom: this.zcaService.getOwnId() || '0',
          },
          threadId: targetChatId,
        },
        onlyMe,
      );
      this.logger.log(
        `Successfully deleted message ${msgId} (onlyMe=${onlyMe}) in chat ${targetChatId}`,
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `Failed to delete message ${msgId} in chat ${targetChatId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Whether messages can go out now (the personal ZCA account is logged in). */
  public isConnected(): boolean {
    return Boolean(this.zcaService?.isLoggedIn());
  }

  public async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const res = await this.sendMessageWithResult(chatId, text);
    return res.success;
  }

  /** ZCA has a single "typing" indicator, so every action shows as typing. */
  public async sendChatAction(
    chatId: string | number,
    _action: ChatAction = 'typing',
  ): Promise<boolean> {
    const targetChatId = String(chatId);
    if (!this.zcaService?.isLoggedIn()) {
      return false;
    }

    try {
      await this.zcaService.sendTyping(
        targetChatId,
        this.zcaService.resolveThreadType(targetChatId),
      );
      return true;
    } catch (err) {
      this.logger.debug(`Error sending typing to ${targetChatId}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Starts a heartbeat sending chat action every intervalMs (default 4000ms),
   * returning an idempotent cleanup function to stop the timer safely.
   */
  public startChatAction(
    chatId: string | number,
    action: ChatAction = 'typing',
    intervalMs = 4000,
  ): () => void {
    const targetChatId = String(chatId);
    let isStopped = false;

    // Send immediately without awaiting
    void this.sendChatAction(targetChatId, action);

    const timer = setInterval(() => {
      if (isStopped) {
        clearInterval(timer);
        return;
      }
      void this.sendChatAction(targetChatId, action);
    }, intervalMs);

    return () => {
      if (!isStopped) {
        isStopped = true;
        clearInterval(timer);
      }
    };
  }

  /**
   * Executes an async operation while maintaining the chat action (e.g. typing) indicator,
   * guaranteeing timer cleanup in the finally block so background tasks are never hanging.
   */
  public async withChatAction<T>(
    chatId: string | number,
    fn: () => Promise<T>,
    action: ChatAction = 'typing',
  ): Promise<T> {
    const stopAction = this.startChatAction(chatId, action);
    try {
      return await fn();
    } finally {
      stopAction();
    }
  }
}
