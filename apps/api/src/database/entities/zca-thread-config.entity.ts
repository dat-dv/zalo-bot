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
    default: () =>
      '\'{"enabled": false, "requireMention": false, "allowAiChat": false, "allowSelf": false}\'',
  })
  directInteraction: ThreadDirectInteractionConfig;

  @Column({
    name: 'media_backup',
    type: 'jsonb',
    default: () =>
      '\'{"enabled": false, "uploadImages": false, "uploadVideos": false, "uploadFiles": false, "uploadAudios": false, "notifyInThread": false, "customFolder": "", "fileSuffix": ""}\'',
  })
  mediaBackup: ThreadMediaBackupConfig;

  @Column({
    name: 'expense_tracking',
    type: 'jsonb',
    default: () => '\'{"enabled": false, "requireConfirm": false}\'',
  })
  expenseTracking: ThreadExpenseConfig;

  @Column({
    name: 'calendar_extraction',
    type: 'jsonb',
    default: () => '\'{"enabled": false, "requireConfirm": false}\'',
  })
  calendarExtraction: ThreadCalendarConfig;

  @Column({
    name: 'confirmation_rules',
    type: 'jsonb',
    default: () => '\'{"allowReactions": false, "requiredHearts": 1, "timeoutMinutes": 5}\'',
  })
  confirmationRules: ThreadConfirmationConfig;

  @Column({ name: 'drive_folder_id', type: 'varchar', nullable: true })
  driveFolderId?: string;

  @Column({ name: 'drive_folder_url', type: 'varchar', nullable: true })
  driveFolderUrl?: string;

  @Column({ name: 'drive_folder_path', type: 'varchar', nullable: true })
  driveFolderPath?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
