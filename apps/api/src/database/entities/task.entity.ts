import type { TaskSource, TaskStatus } from '@zalobot/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A to-do owned by the system. Like the finance ledger, the task list is shared: everyone
 * sees every task, and the creator and source chat are recorded for display. Tasks live only
 * here; they are not copied to or imported from Google Tasks.
 */
@Entity('tasks')
@Index('IDX_tasks_status_due_at', ['status', 'dueAt'])
@Index('IDX_tasks_status_remind_at', ['status', 'remindAt'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

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

  /** One-off reminder time; the bot posts the task into `remindChatId` while it is still open. */
  @Column({ name: 'remind_at', type: 'timestamptz', nullable: true })
  remindAt?: Date | null;

  /** Zalo thread (group id or private-chat uid) that receives the reminder. */
  @Column({ name: 'remind_chat_id', type: 'varchar', nullable: true })
  remindChatId?: string | null;

  /** Set when the reminder was sent or skipped; cleared when the time or chat changes. */
  @Column({ name: 'reminded_at', type: 'timestamptz', nullable: true })
  remindedAt?: Date | null;

  @Index('IDX_tasks_deleted_at')
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
