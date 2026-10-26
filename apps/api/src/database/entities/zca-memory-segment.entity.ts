import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Part of today's chat sent to Cognee after the chat went quiet (or on `/sync`), so new messages
 * are remembered within minutes. The nightly job forgets a day's segments and sends the whole day
 * as one document instead.
 */
@Entity('zca_memory_segments')
@Index('IDX_zca_memory_segments_channel_day', ['channelId', 'day'])
export class ZcaMemorySegmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'varchar' })
  channelId: string;

  /** `YYYY-MM-DD` in the bot timezone. */
  @Column({ type: 'date' })
  day: string;

  @Column({ name: 'from_sent_at', type: 'timestamptz' })
  fromSentAt: Date;

  /** Last message in the segment; the next segment starts after it. */
  @Column({ name: 'to_sent_at', type: 'timestamptz' })
  toSentAt: Date;

  /** `<datasetId>:<dataId>`: both are needed to forget the document. */
  @Column({ name: 'cognee_data_id', type: 'varchar' })
  cogneeDataId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
