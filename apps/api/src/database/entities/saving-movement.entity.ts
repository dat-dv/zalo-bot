import type { SavingMovementType } from '@zalobot/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SavingGroupEntity } from './saving-group.entity';

/**
 * Money moved between the wallet and a savings group. Kept apart from `finance_transactions`
 * because a move is not income or an expense, and the ledger code treats any non-income row as
 * an expense.
 */
@Entity('saving_movements')
export class SavingMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => SavingGroupEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_id' })
  group?: SavingGroupEntity;

  @Column({ type: 'varchar' })
  type: SavingMovementType;

  @Column({ type: 'integer' })
  amount: number;

  @Index()
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'varchar', nullable: true })
  note?: string | null;

  @Index()
  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId?: string | null;

  @Column({ name: 'created_by_name', type: 'varchar', nullable: true })
  createdByName?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
