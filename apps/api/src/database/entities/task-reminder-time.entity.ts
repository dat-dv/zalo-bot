import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskEntity } from './task.entity';

/**
 * One reminder time of a task. A task can remind several times; each row is sent once
 * (`sent_at`), so overlapping scheduler ticks claim a row with a conditional update.
 */
@Entity('task_reminder_times')
@Index('IDX_task_reminder_times_due', ['sentAt', 'remindAt'])
export class TaskReminderTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_task_reminder_times_task_id')
  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @Column({ name: 'remind_at', type: 'timestamptz' })
  remindAt: Date;

  /** When this time went out, or was skipped (e.g. it passed while the task was done). */
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
