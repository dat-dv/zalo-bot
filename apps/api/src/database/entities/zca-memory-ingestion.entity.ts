import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * `pending`: not sent yet; `ingested`: in Cognee; `stale`: a message of that day was recalled, so
 * the day is sent again without it; `failed`: retried on the next nights.
 */
export type MemoryIngestionStatus = 'pending' | 'ingested' | 'stale' | 'failed';

/** One chat day sent to Cognee as one document. */
@Entity('zca_memory_ingestions')
@Unique('UQ_zca_memory_ingestions_channel_day', ['channelId', 'day'])
export class ZcaMemoryIngestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'varchar' })
  channelId: string;

  /** `YYYY-MM-DD` in the bot timezone. */
  @Column({ type: 'date' })
  day: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: MemoryIngestionStatus;

  @Column({ name: 'cognee_data_id', type: 'varchar', nullable: true })
  cogneeDataId?: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'ingested_at', type: 'timestamptz', nullable: true })
  ingestedAt?: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
