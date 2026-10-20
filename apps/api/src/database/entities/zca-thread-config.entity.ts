import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import type {
  ThreadDirectInteractionConfig,
  ThreadMediaBackupConfig,
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
      '\'{"enabled": false, "triggerPrefixes": [], "allowAiChat": false, "allowSelf": false}\'',
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

  @Column({ name: 'photos_album_id', type: 'varchar', nullable: true })
  photosAlbumId?: string;

  @Column({ name: 'photos_album_url', type: 'varchar', nullable: true })
  photosAlbumUrl?: string;

  @Column({ name: 'photos_album_title', type: 'varchar', nullable: true })
  photosAlbumTitle?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
