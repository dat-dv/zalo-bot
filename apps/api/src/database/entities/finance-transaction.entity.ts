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
import { FinancePlaceEntity } from './finance-place.entity';
import { DebtPaymentAllocationEntity } from './debt-payment-allocation.entity';
import { DebtPaymentEntity } from './debt-payment.entity';

@Entity('finance_transactions')
export class FinanceTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  type: 'income' | 'expense';

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', default: 'VND' })
  currency: string;

  @Column({ type: 'varchar', default: 'Khác' })
  category: string;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod?: string;

  @Column({ name: 'receipt_url', type: 'varchar', nullable: true })
  receiptUrl?: string;

  @Index()
  @Column({ name: 'contact_id', type: 'varchar', nullable: true })
  contactId?: string;

  @ManyToOne(() => DebtContactEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contact_id' })
  contact?: DebtContactEntity;

  @Index()
  @Column({ name: 'place_id', type: 'varchar', nullable: true })
  placeId?: string;

  @ManyToOne(() => FinancePlaceEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'place_id' })
  place?: FinancePlaceEntity;

  @Column({ type: 'varchar' })
  note: string;

  /** Who sent the message / used the dashboard to create this row (ledger owner may differ). */
  @Index()
  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId?: string;

  /** Display name snapshot at creation, used when the creator has no users row. */
  @Column({ name: 'created_by_name', type: 'varchar', nullable: true })
  createdByName?: string;

  @Column({ type: 'varchar', nullable: true })
  source?: 'zalo' | 'dashboard';

  @Column({ name: 'source_chat_id', type: 'varchar', nullable: true })
  sourceChatId?: string;

  @Index()
  @Column({ name: 'occurred_at', type: Date })
  occurredAt: Date;

  @OneToMany(() => DebtPaymentAllocationEntity, (alloc) => alloc.financeTransaction)
  allocations?: DebtPaymentAllocationEntity[];

  @OneToMany(() => DebtPaymentEntity, (payment) => payment.financeTransaction)
  debtPayments?: DebtPaymentEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
