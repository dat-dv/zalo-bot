import type {
  IReminderTargetUser,
  ReminderRepeatType,
  ReminderTargetMode,
} from '@zalobot/contracts';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reminders')
export class ReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Index()
  @Column({ name: 'remind_at', type: Date })
  remindAt: Date;

  @Index()
  @Column({ name: 'is_triggered', type: 'boolean', default: false })
  isTriggered: boolean;

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'completed' | 'snoozed' | 'cancelled';

  @Column({ name: 'snooze_count', type: 'integer', default: 0 })
  snoozeCount: number;

  @Column({ name: 'snoozed_until', type: Date, nullable: true })
  snoozedUntil?: Date;

  @Column({ name: 'completed_at', type: Date, nullable: true })
  completedAt?: Date;

  @Column({ name: 'notify_type', type: 'varchar', default: 'text' })
  notifyType: 'text' | 'call';

  /**
   * Legacy: the repeat of the earliest time, kept for older readers. Each time has its own
   * repeat (`reminder_times.repeat_type`).
   */
  @Column({ name: 'repeat_type', type: 'varchar', default: 'none' })
  repeatType: ReminderRepeatType;

  /** Remind again every this many minutes after each time, `nag_count` times; null = never. */
  @Column({ name: 'nag_every_minutes', type: 'integer', nullable: true })
  nagEveryMinutes?: number | null;

  @Column({ name: 'nag_count', type: 'integer', nullable: true })
  nagCount?: number | null;

  /** Chat the reminder goes to; NULL (rows before reminder targets) = `userId`'s private chat. */
  @Column({ name: 'chat_id', type: 'varchar', nullable: true })
  chatId?: string | null;

  /** Members of the reminder group to remind (see `ReminderTarget`); empty for a private chat. */
  @Column({ name: 'remind_users', type: 'jsonb', default: () => "'[]'" })
  remindUsers?: IReminderTargetUser[];

  @Column({ name: 'remind_mode', type: 'varchar', default: 'mention' })
  remindMode?: ReminderTargetMode;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
