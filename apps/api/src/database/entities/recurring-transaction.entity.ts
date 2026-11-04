import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { RecurringMode, RecurringRepeatType } from '@zalobot/contracts';
import { FinancePlaceEntity } from './finance-place.entity';

/** A rule that produces one occurrence per period: rent, power bill, salary. */
@Entity('recurring_transactions')
export class RecurringTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: 'income' | 'expense';

  /** Empty only in `confirm` mode: the amount changes each period (power, water). */
  @Column({ type: 'integer', nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', default: 'Khác' })
  category: string;

  @Column({ type: 'varchar' })
  note: string;

  @Column({ name: 'place_id', type: 'uuid', nullable: true })
  placeId: string | null;

  @ManyToOne(() => FinancePlaceEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'place_id' })
  place?: FinancePlaceEntity | null;

  @Column({ name: 'repeat_type', type: 'varchar' })
  repeatType: RecurringRepeatType;

  @Column({ name: 'repeat_weekdays', type: 'jsonb', default: () => "'[]'" })
  repeatWeekdays: number[];

  /** Fixes the day and time of the schedule; a monthly 31st stays the 31st after a short month. */
  @Column({ name: 'anchor_at', type: 'timestamptz' })
  anchorAt: Date;

  @Index()
  @Column({ name: 'next_due_at', type: 'timestamptz' })
  nextDueAt: Date;

  @Column({ type: 'varchar' })
  mode: RecurringMode;

  /** Listened chat told about each period; empty means the rule stays silent on Zalo. */
  @Column({ name: 'notify_chat_id', type: 'varchar', nullable: true })
  notifyChatId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'created_by_name', type: 'varchar', nullable: true })
  createdByName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
