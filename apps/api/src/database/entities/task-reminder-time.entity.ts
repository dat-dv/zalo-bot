import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ReminderRepeatType } from '@zalobot/contracts';
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

  /** How this time repeats (`none`, `daily`, `weekdays`, `weekly`, `monthly`). */
  @Column({ name: 'repeat_type', type: 'varchar', default: 'none' })
  repeatType?: ReminderRepeatType;

  /** Weekdays of a `weekly` repeat, 0 = Sunday (Vietnam time); empty = this time's weekday. */
  @Column({ name: 'repeat_weekdays', type: 'smallint', array: true, default: () => "'{}'" })
  repeatWeekdays?: number[];

  /** The time as first set (null = `remind_at`); a monthly repeat keeps its day of the month. */
  @Column({ name: 'anchor_at', type: 'timestamptz', nullable: true })
  anchorAt?: Date | null;

  /** When to remind again next; null when not reminding again. */
  @Column({ name: 'nag_at', type: 'timestamptz', nullable: true })
  nagAt?: Date | null;

  @Column({ name: 'nag_left', type: 'integer', default: 0 })
  nagLeft?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
