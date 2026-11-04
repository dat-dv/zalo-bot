import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('saving_groups')
@Unique('UQ_saving_groups_normalized_name', ['normalizedName'])
export class SavingGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'normalized_name', type: 'varchar' })
  normalizedName: string;

  @Column({ type: 'varchar', nullable: true })
  note?: string | null;

  /** Archived groups keep their history but take no new movements. */
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  /** Who created the group (display only; finance data is shared). */
  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId?: string | null;

  /** Display name snapshot at creation, used when the creator has no users row. */
  @Column({ name: 'created_by_name', type: 'varchar', nullable: true })
  createdByName?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
