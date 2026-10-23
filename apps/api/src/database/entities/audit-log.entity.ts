import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AuditAction, AuditActorSource } from '@zalobot/contracts';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'table_name', type: 'varchar' })
  tableName: string;

  @Index()
  @Column({ name: 'record_id', type: 'varchar', nullable: true })
  recordId?: string;

  @Column({ type: 'varchar' })
  action: AuditAction;

  @Index()
  @Column({ name: 'actor_id', type: 'varchar', nullable: true })
  actorId?: string | null;

  /** Zalo display name of the sender at the time of the change; NULL for other sources. */
  @Column({ name: 'actor_name', type: 'varchar', nullable: true })
  actorName?: string | null;

  /** NULL on rows written before the actor was recorded; their `actorId` is the row's creator. */
  @Column({ name: 'actor_source', type: 'varchar', nullable: true })
  actorSource?: AuditActorSource | null;

  /** Zalo chat the change came from. */
  @Column({ name: 'channel_id', type: 'varchar', nullable: true })
  channelId?: string | null;

  @Column({ name: 'before_data', type: 'simple-json', nullable: true })
  beforeData?: Record<string, unknown>;

  @Column({ name: 'after_data', type: 'simple-json', nullable: true })
  afterData?: Record<string, unknown>;

  // Indexed DESC by migration AddAuditLogActorSource for the newest-first activity log.
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
