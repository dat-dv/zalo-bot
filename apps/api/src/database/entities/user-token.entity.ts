import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('user_tokens')
export class UserTokenEntity {
  @PrimaryColumn('varchar')
  userId: string;

  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'text', nullable: true })
  scope?: string;

  @Column({ type: 'varchar', nullable: true })
  tokenType?: string;

  @Column({ type: 'bigint', nullable: true })
  expiryDate?: number;

  /** The one token used as the shared Google account (Drive/Photos storage, shared fallback). */
  @Column({ name: 'is_shared', type: 'boolean', default: false })
  isShared: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
