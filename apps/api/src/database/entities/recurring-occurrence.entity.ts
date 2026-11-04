import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { RecurringOccurrenceStatus } from '@zalobot/contracts';
import { RecurringTransactionEntity } from './recurring-transaction.entity';

/**
 * One period of a rule. Stored rather than derived because a `due` row may wait for days, far past
 * the 5-minute life of a pending card; the unique key is what stops a period being recorded twice.
 */
@Entity('recurring_occurrences')
@Unique('UQ_recurring_occurrences_rule_due', ['ruleId', 'dueAt'])
export class RecurringOccurrenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @ManyToOne(() => RecurringTransactionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule?: RecurringTransactionEntity;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  /** The rule's amount when the period came up; later rule edits do not rewrite it. */
  @Column({ type: 'integer', nullable: true })
  amount: number | null;

  @Index()
  @Column({ type: 'varchar', default: 'due' })
  status: RecurringOccurrenceStatus;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  /** Set once the chat was told, or at creation when the rule has no chat. */
  @Index()
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
