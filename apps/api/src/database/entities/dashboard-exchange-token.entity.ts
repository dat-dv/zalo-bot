import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dashboard_exchange_tokens')
export class DashboardExchangeTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar' })
  tokenHash: string;

  /** SHA-256 of the normalized sign-in code sent with the link; consumed together with the link. */
  @Index({ unique: true })
  @Column({ name: 'code_hash', type: 'varchar', nullable: true })
  codeHash?: string | null;

  @Index()
  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ name: 'expires_at', type: Date })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: Date, nullable: true })
  consumedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
