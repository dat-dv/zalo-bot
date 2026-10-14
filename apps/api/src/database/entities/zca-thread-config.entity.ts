import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import type {
  ThreadDirectInteractionConfig,
  ThreadMediaBackupConfig,
  ThreadExpenseConfig,
  ThreadCalendarConfig,
  ThreadConfirmationConfig,
} from '@zalobot/contracts';

@Entity('zca_thread_configs')
export class ZcaThreadConfigEntity {
  @PrimaryColumn({ name: 'thread_id', type: 'varchar' })
  threadId: string;

  @Column({ name: 'thread_name', type: 'varchar', nullable: true })
  threadName?: string;

  @Column({ name: 'thread_type', type: 'varchar', default: 'user' })
  threadType: 'user' | 'group';

  @Index()
  @Column({ name: 'is_listened', type: 'boolean', default: false })
  isListened: boolean;

  @Column({
    name: 'direct_interaction',
    type: 'jsonb',
    default: () => '\'{"enabled": true, "requireMention": false, "allowAiChat": true}\'',
  })
  directInteraction: ThreadDirectInteractionConfig;

  @Column({ name: 'media_backup', type: 'jsonb', default: () => "'{}'" })
  mediaBackup: ThreadMediaBackupConfig;

  @Column({ name: 'expense_tracking', type: 'jsonb', default: () => "'{}'" })
  expenseTracking: ThreadExpenseConfig;

  @Column({ name: 'calendar_extraction', type: 'jsonb', default: () => "'{}'" })
  calendarExtraction: ThreadCalendarConfig;

  @Column({ name: 'confirmation_rules', type: 'jsonb', default: () => "'{}'" })
  confirmationRules: ThreadConfirmationConfig;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
