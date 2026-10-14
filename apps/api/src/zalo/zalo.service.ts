import { Injectable, Logger, OnModuleInit, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZALO_API_URLS } from './zalo.constants';
import { ZcaService } from '../zca/zca.service';

@Injectable()
export class ZaloService implements OnModuleInit {
  private readonly logger = new Logger(ZaloService.name);
  private token: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ZcaService,
  ) {
    this.token = this.configService.get<string>('zalo.botToken') || null;

    if (!this.token) {
      this.logger.warn('ZALO_BOT_TOKEN is not configured.');
    }
  }

  public onModuleInit(): void {
    const webhookUrl = this.configService.get<string>('zalo.webhookUrl');
    if (webhookUrl) {
      this.logger.log(`Zalo webhook configured for endpoint: ${webhookUrl}`);
    }
  }

  public async sendMessageWithResult(
    chatId: string | number,
    text: string,
  ): Promise<{ success: boolean; msgId?: string; cliMsgId?: string }> {
    const targetChatId = String(chatId);

    if (!this.token) {
      if (this.zcaService?.isLoggedIn()) {
        try {
          const res = await this.zcaService.sendMessage(text, targetChatId);
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
      this.logger.warn(`Zalo token not configured. Outgoing message to ${targetChatId}: "${text}"`);
      return { success: false };
    }

    const entrypoint = ZALO_API_URLS.BOT_SEND_MESSAGE(this.token);

    this.logger.log({
      entrypoint,
      targetChatId,
      text,
    });
    try {
      const response = await fetch(entrypoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
        }),
      });

      const data = (await response.json().catch((): null => null)) as {
        ok?: boolean;
        error?: number;
        message?: string;
        description?: string;
        data?: { message_id?: string | number; cli_msg_id?: string | number };
        message_id?: string | number;
      } | null;

      if (!response.ok || data?.ok === false || (data?.error !== 0 && data?.error !== undefined)) {
        if (this.zcaService?.isLoggedIn()) {
          try {
            const res = await this.zcaService.sendMessage(text, targetChatId);
            const rawMsg = res?.message as unknown as
              { msgId?: string | number; cliMsgId?: string | number } | undefined;
            const msgId = rawMsg?.msgId !== undefined ? String(rawMsg.msgId) : undefined;
            const cliMsgId = rawMsg?.cliMsgId !== undefined ? String(rawMsg.cliMsgId) : undefined;
            this.logger.log(`Fallback: Successfully sent message via ZCA to chat ${targetChatId}`);
            return { success: true, msgId, cliMsgId };
          } catch {
            // Keep original error log below
          }
        }
        this.logger.error(
          `Failed to send Zalo message to ${targetChatId}: ${JSON.stringify(data || response.statusText)}`,
        );
        return { success: false };
      }

      const msgId = data?.data?.message_id ?? data?.message_id;
      const cliMsgId = data?.data?.cli_msg_id;
      this.logger.log(`Successfully sent message to Zalo chat ${targetChatId}`);
      return {
        success: true,
        msgId: msgId !== undefined ? String(msgId) : undefined,
        cliMsgId: cliMsgId !== undefined ? String(cliMsgId) : undefined,
      };
    } catch (err) {
      this.logger.error(`Error sending Zalo message to ${targetChatId}: ${(err as Error).message}`);
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
      this.logger.debug(`[ZaloService] Cannot recall message ${msgId}: ZCA is not logged in.`);
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
      this.logger.log(
        `[ZaloService] Successfully recalled message ${msgId} in chat ${targetChatId}`,
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `[ZaloService] Failed to recall message ${msgId} in chat ${targetChatId}: ${(err as Error).message}`,
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
        this.logger.log(
          `[ZaloService] Fallback deleted message ${msgId} (onlyMe) in chat ${targetChatId}`,
        );
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
        `[ZaloService] Successfully deleted message ${msgId} (onlyMe=${onlyMe}) in chat ${targetChatId}`,
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `[ZaloService] Failed to delete message ${msgId} in chat ${targetChatId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  public async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const res = await this.sendMessageWithResult(chatId, text);
    return res.success;
  }

  public async sendChatAction(
    chatId: string | number,
    action: 'typing' | 'upload_photo' = 'typing',
  ): Promise<boolean> {
    const targetChatId = String(chatId);

    if (!this.token) {
      this.logger.debug(
        `Zalo token not configured. Skipping chat action "${action}" to ${targetChatId}`,
      );
      return false;
    }

    const entrypoint = ZALO_API_URLS.BOT_SEND_CHAT_ACTION(this.token);

    try {
      const response = await fetch(entrypoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: targetChatId,
          action,
        }),
      });

      const data = (await response.json().catch((): null => null)) as {
        ok?: boolean;
        error?: number;
        message?: string;
        description?: string;
      } | null;

      if (!response.ok || data?.ok === false || (data?.error !== 0 && data?.error !== undefined)) {
        this.logger.debug(
          `Failed to send chat action "${action}" to ${targetChatId}: ${JSON.stringify(data || response.statusText)}`,
        );
        return false;
      }

      return true;
    } catch (err) {
      this.logger.debug(`Error sending chat action to ${targetChatId}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Starts a heartbeat sending chat action every intervalMs (default 4000ms),
   * returning an idempotent cleanup function to stop the timer safely.
   */
  public startChatAction(
    chatId: string | number,
    action: 'typing' | 'upload_photo' = 'typing',
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
    action: 'typing' | 'upload_photo' = 'typing',
  ): Promise<T> {
    const stopAction = this.startChatAction(chatId, action);
    try {
      return await fn();
    } finally {
      stopAction();
    }
  }
}
