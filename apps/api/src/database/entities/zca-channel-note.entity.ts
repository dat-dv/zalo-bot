import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Something members told the bot to always remember in one chat (Ghi nhớ), e.g. its persona.
 * Every note of the chat is added to every prompt, so the list is kept short.
 */
@Entity('zca_channel_notes')
@Index('IDX_zca_channel_notes_channel', ['channelId', 'createdAt'])
export class ZcaChannelNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'varchar' })
  channelId: string;

  @Column({ type: 'varchar', length: 200 })
  text: string;

  /** `users.id` of whoever asked for it; null when added on the dashboard by the system owner. */
  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'source_msg_id', type: 'varchar', nullable: true })
  sourceMsgId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
