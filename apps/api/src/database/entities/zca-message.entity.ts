import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * One message of a listened ZCA thread (chat memory). `search_vector` is a generated column
 * maintained by Postgres (see migration CreateZcaMessages), so it is never read or written here.
 */
@Entity('zca_messages')
@Unique('UQ_zca_messages_channel_msg', ['channelId', 'msgId'])
export class ZcaMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'varchar' })
  channelId: string;

  @Column({ name: 'channel_type', type: 'varchar', default: 'user' })
  channelType: 'user' | 'group';

  @Column({ name: 'msg_id', type: 'varchar' })
  msgId: string;

  @Column({ name: 'cli_msg_id', type: 'varchar', nullable: true })
  cliMsgId?: string | null;

  @Column({ name: 'sender_uid', type: 'varchar', default: '' })
  senderUid: string;

  @Column({ name: 'sender_name', type: 'varchar', nullable: true })
  senderName?: string | null;

  @Column({ name: 'is_bot', type: 'boolean', default: false })
  isBot: boolean;

  @Column({ name: 'msg_type', type: 'varchar', default: 'webchat' })
  msgType: string;

  @Column({ type: 'text', nullable: true })
  text?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  content?: Record<string, unknown> | null;

  @Column({ name: 'quote_msg_id', type: 'varchar', nullable: true })
  quoteMsgId?: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;

  @Column({ name: 'recalled_at', type: 'timestamptz', nullable: true })
  recalledAt?: Date | null;

  /** `MemoryKind` (see `zca/memory/memory-kind.ts`): which memories may use this row. */
  @Column({ name: 'memory_kind', type: 'varchar', default: 'chat' })
  memoryKind: string;

  /** Set for rows kept only for the short-term memory (long-term off); purged once past. */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
