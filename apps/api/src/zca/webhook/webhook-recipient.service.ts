import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IWebhookRecipient } from '@zalobot/contracts';
import { WebhookRecipientEntity } from '../../database/entities/webhook-recipient.entity';

/** Chats picked in Settings → Webhook; the only ones the webhook may list or message. */
@Injectable()
export class WebhookRecipientService {
  constructor(
    @InjectRepository(WebhookRecipientEntity)
    private readonly repository: Repository<WebhookRecipientEntity>,
  ) {}

  /** Groups first, then by name, the order the settings list and a broadcast use. */
  public async list(): Promise<IWebhookRecipient[]> {
    const rows = await this.repository.find();
    return rows.map(toRecipient).sort(compareRecipients);
  }

  public async find(threadId: string): Promise<IWebhookRecipient | null> {
    const row = await this.repository.findOne({ where: { threadId } });
    return row ? toRecipient(row) : null;
  }

  /** Saves `recipients` as the whole list: chats left out stop receiving webhook messages. */
  public async replace(recipients: IWebhookRecipient[]): Promise<IWebhookRecipient[]> {
    const unique = new Map<string, IWebhookRecipient>();
    for (const recipient of recipients) unique.set(recipient.threadId, recipient);

    await this.repository.manager.transaction(async (manager) => {
      await manager.clear(WebhookRecipientEntity);
      if (unique.size === 0) return;
      await manager.insert(
        WebhookRecipientEntity,
        [...unique.values()].map((recipient) => ({
          threadId: recipient.threadId,
          threadName: recipient.threadName?.trim() || null,
          threadType: recipient.threadType,
        })),
      );
    });
    return this.list();
  }
}

function toRecipient(row: WebhookRecipientEntity): IWebhookRecipient {
  return { threadId: row.threadId, threadName: row.threadName, threadType: row.threadType };
}

export function compareRecipients(a: IWebhookRecipient, b: IWebhookRecipient): number {
  if (a.threadType !== b.threadType) return a.threadType === 'group' ? -1 : 1;
  return (a.threadName ?? a.threadId).localeCompare(b.threadName ?? b.threadId, 'vi');
}
