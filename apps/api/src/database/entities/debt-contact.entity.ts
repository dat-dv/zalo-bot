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
import type {
  ContactRelationship,
  IContactBankAccountEntry,
  IContactPhoneEntry,
} from '@zalobot/contracts';
import { UserEntity } from './user.entity';

@Entity('debt_contacts')
export class DebtContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'display_name', type: 'varchar' })
  displayName: string;

  @Column({ type: 'varchar', nullable: true })
  alias?: string;

  @Index()
  @Column({ name: 'normalized_name', type: 'varchar' })
  normalizedName: string;

  @Index()
  @Column({ name: 'normalized_alias', type: 'varchar', nullable: true })
  normalizedAlias?: string;

  @Column({ type: 'varchar', nullable: true })
  descriptor?: string;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber?: string;

  @Column({ name: 'bank_account_number', type: 'varchar', nullable: true })
  bankAccountNumber?: string;

  @Column({ name: 'bank_code', type: 'varchar', nullable: true })
  bankCode?: string;

  @Column({ name: 'bank_name', type: 'varchar', nullable: true })
  bankName?: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl?: string;

  /** Profile fields (see `IContactProfileFields`). */
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  /** `YYYY-MM-DD`; pg `date` is read back as a string. */
  @Column({ type: 'date', nullable: true })
  birthday?: string | null;

  @Column({ type: 'varchar', nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', nullable: true })
  workplace?: string | null;

  @Column({ type: 'varchar', nullable: true })
  relationship?: ContactRelationship | null;

  @Column({ name: 'extra_phones', type: 'jsonb', default: () => "'[]'::jsonb" })
  extraPhones?: IContactPhoneEntry[];

  @Column({ name: 'extra_bank_accounts', type: 'jsonb', default: () => "'[]'::jsonb" })
  extraBankAccounts?: IContactBankAccountEntry[];

  @Index()
  @Column({ name: 'linked_user_id', type: 'varchar', nullable: true })
  linkedUserId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_user_id' })
  linkedUser?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
