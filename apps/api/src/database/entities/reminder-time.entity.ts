import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
