import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DebtEntity } from './debt.entity';
import { FinanceTransactionEntity } from './finance-transaction.entity';

@Entity('debt_payment_allocations')
export class DebtPaymentAllocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'finance_transaction_id', type: 'varchar' })
  financeTransactionId: string;

  @ManyToOne(() => FinanceTransactionEntity, (tx) => tx.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'finance_transaction_id' })
  financeTransaction?: FinanceTransactionEntity;

  @Index()
  @Column({ name: 'debt_id', type: 'varchar' })
  debtId: string;

  @ManyToOne(() => DebtEntity, (debt) => debt.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt?: DebtEntity;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'allocated_at', type: Date })
  allocatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
