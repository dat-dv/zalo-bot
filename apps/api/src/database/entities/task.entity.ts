import type { TaskSource, TaskStatus, GoogleSyncStatus } from '@zalobot/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A to-do owned by the system. Like the calendar, the task list is shared: everyone sees
 * every task, and the creator and source chat are recorded for display. Google Tasks only
 * holds a copy (`google_task_id` in `google_account_email`), so switching Google accounts
 * never loses tasks.
 */
@Entity('tasks')
@Index('IDX_tasks_google_copy', ['googleAccountEmail', 'googleTaskId'], {
  unique: true,
  where: '"google_task_id" IS NOT NULL',
})
@Index('IDX_tasks_status_due_at', ['status', 'dueAt'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  /** Google Tasks keeps only the date part of a due time. */
  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt?: Date | null;

  @Column({ type: 'varchar' })
  status: TaskStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId?: string | null;

  /** Name snapshot for creators without a users row; the current profile name wins on display. */
  @Column({ name: 'created_by_name', type: 'varchar', nullable: true })
  createdByName?: string | null;

  @Column({ type: 'varchar' })
  source: TaskSource;

  @Column({ name: 'source_chat_id', type: 'varchar', nullable: true })
  sourceChatId?: string | null;

  @Column({ name: 'google_task_id', type: 'varchar', nullable: true })
  googleTaskId?: string | null;

  /** `@default` until an import learns the real list id. */
  @Column({ name: 'google_task_list_id', type: 'varchar', nullable: true })
  googleTaskListId?: string | null;

  @Column({ name: 'google_account_email', type: 'varchar', nullable: true })
  googleAccountEmail?: string | null;

  @Column({ name: 'sync_status', type: 'varchar' })
  syncStatus: GoogleSyncStatus;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt?: Date | null;

  @Index('IDX_tasks_deleted_at')
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
