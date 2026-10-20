import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole, GrantAccessStatus, type SupportedLocale } from '@zalobot/contracts';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('varchar')
  id: string; // Store user ID as string for precision

  @Column({ type: 'varchar', nullable: true })
  username?: string;

  @Column({ type: 'varchar', nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', default: 'vi' })
  preferredLocale: SupportedLocale;

  @Column({ type: 'varchar', default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Column({ name: 'grant_access', type: 'int', default: GrantAccessStatus.DENIED })
  grantAccess: GrantAccessStatus;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber?: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'suspended';

  /** The single user whose ledger every sender's finance data is recorded under (shared ledger). */
  @Column({ name: 'is_ledger_owner', type: 'boolean', default: false })
  isLedgerOwner: boolean;

  @Column({ name: 'drive_folder_id', type: 'varchar', nullable: true })
  driveFolderId?: string;

  @Column({ name: 'drive_folder_url', type: 'varchar', nullable: true })
  driveFolderUrl?: string;

  @Column({ name: 'drive_folder_path', type: 'varchar', nullable: true })
  driveFolderPath?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
