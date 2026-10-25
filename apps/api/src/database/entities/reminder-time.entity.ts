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
import { ReminderEntity } from './reminder.entity';

/**
 * One time of a personal reminder. A reminder can remind several times; a repeating
 * reminder moves each of its times forward instead of marking it sent.
 */
@Entity('reminder_times')
@Index('IDX_reminder_times_due', ['sentAt', 'remindAt'])
export class ReminderTimeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_reminder_times_reminder_id')
  @Column({ name: 'reminder_id', type: 'uuid' })
  reminderId: string;

  @ManyToOne(() => ReminderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reminder_id' })
  reminder?: ReminderEntity;

  // Same `timestamp` type as `reminders.remind_at`, so times read back exactly like before.
  @Column({ name: 'remind_at', type: Date })
  remindAt: Date;

  /** When this time went out (one-off reminders only). */
  @Column({ name: 'sent_at', type: Date, nullable: true })
  sentAt?: Date | null;

  /** How this time repeats (`none`, `daily`, `weekdays`, `weekly`, `monthly`, `yearly`). */
  @Column({ name: 'repeat_type', type: 'varchar', default: 'none' })
  repeatType?: ReminderRepeatType;

  /** Weekdays of a `weekly` repeat, 0 = Sunday (Vietnam time); empty = this time's weekday. */
  @Column({ name: 'repeat_weekdays', type: 'smallint', array: true, default: () => "'{}'" })
  repeatWeekdays?: number[];

  /**
   * The time as first set (null = `remind_at`): a monthly repeat keeps its day of the month, a
   * yearly one its day and month.
   */
  @Column({ name: 'anchor_at', type: Date, nullable: true })
  anchorAt?: Date | null;

  /** When to remind again next; null when not reminding again. */
  @Column({ name: 'nag_at', type: Date, nullable: true })
  nagAt?: Date | null;

  @Column({ name: 'nag_left', type: 'integer', default: 0 })
  nagLeft?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
