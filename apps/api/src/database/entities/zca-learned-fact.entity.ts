import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type LearnedFactSubjectKind = 'bot' | 'member';

/**
 * A fact the nightly job learned from a chat about the bot or one member ("Hằng ăn chay").
 * Used at once in prompts; a deleted fact keeps its row (`deleted_at`) so it is not learned again.
 */
@Entity('zca_learned_facts')
@Index('IDX_zca_learned_facts_channel', ['channelId', 'subjectKind', 'subjectUserId'])
export class ZcaLearnedFactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'varchar' })
  channelId: string;

  @Column({ name: 'subject_kind', type: 'varchar' })
  subjectKind: LearnedFactSubjectKind;

  /** `users.id` of the member; null for the bot. */
  @Column({ name: 'subject_user_id', type: 'varchar', nullable: true })
  subjectUserId?: string | null;

  @Column({ name: 'subject_name', type: 'varchar' })
  subjectName: string;

  @Column({ type: 'varchar', length: 300 })
  fact: string;

  @Column({ name: 'learned_at', type: 'timestamptz', default: () => 'now()' })
  learnedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'deleted_by', type: 'varchar', nullable: true })
  deletedBy?: string | null;
}
