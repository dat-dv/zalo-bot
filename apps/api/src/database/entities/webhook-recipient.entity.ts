import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * A Zalo user or group the admin picked in Settings → Webhook. `POST /api/webhooks/send` only
 * messages these chats (all of them, or the one named by `targetId`), and
 * `GET /api/webhooks/targets` only lists them.
 */
@Entity('webhook_recipients')
export class WebhookRecipientEntity {
  @PrimaryColumn({ name: 'thread_id', type: 'varchar' })
  threadId: string;

  /** Name when it was picked, so the list stays readable while the Zalo directory is cold. */
  @Column({ name: 'thread_name', type: 'varchar', nullable: true })
  threadName: string | null;

  @Column({ name: 'thread_type', type: 'varchar' })
  threadType: 'user' | 'group';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
