import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DebtContactEntity } from './debt-contact.entity';
import { DebtPaymentEntity } from './debt-payment.entity';
import { DebtPaymentAllocationEntity } from './debt-payment-allocation.entity';

@Entity('debts')
export class DebtEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'contact_id', type: 'varchar', nullable: true })
  contactId?: string;

  @ManyToOne(() => DebtContactEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contact_id' })
  contact?: DebtContactEntity;

  @Index()
  @Column({ name: 'parent_debt_id', type: 'varchar', nullable: true })
  parentDebtId?: string;

  @ManyToOne(() => DebtEntity, (debt) => debt.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_debt_id' })
  parentDebt?: DebtEntity;

  @OneToMany(() => DebtEntity, (debt) => debt.parentDebt)
  children?: DebtEntity[];

  @Column({ type: 'varchar' })
  direction: 'receivable' | 'payable';

  @Column({ type: 'varchar' })
  counterparty: string;

  @Column({ name: 'counterparty_alias', type: 'varchar', nullable: true })
  counterpartyAlias?: string;

  @Column({ name: 'original_amount', type: 'integer' })
  originalAmount: number;

  @Column({ name: 'remaining_amount', type: 'integer' })
  remainingAmount: number;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'varchar', default: '' })
  note: string;

  @Index()
  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'settled';

  @Column({ name: 'due_at', type: Date, nullable: true })
  dueAt?: Date;

  @Column({ name: 'settled_at', type: Date, nullable: true })
  settledAt?: Date;

  @Index()
  @Column({ name: 'occurred_at', type: Date, nullable: true })
  occurredAt?: Date;

  @OneToMany(() => DebtPaymentEntity, (payment) => payment.debt)
  payments?: DebtPaymentEntity[];

  @OneToMany(() => DebtPaymentAllocationEntity, (alloc) => alloc.debt)
  allocations?: DebtPaymentAllocationEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
