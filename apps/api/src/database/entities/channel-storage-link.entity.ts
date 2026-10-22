import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type ChannelStorageLinkKind = 'drive' | 'photos';

/**
 * One Drive root folder or Photos album a channel's media has gone to. Rows are kept after the
 * shared Google account changes, so the dashboard can still list where older media lives.
 */
@Entity('channel_storage_links')
@Unique('UQ_channel_storage_links_resource', ['threadId', 'kind', 'resourceId'])
@Index('IDX_channel_storage_links_thread_kind', ['threadId', 'kind', 'lastUsedAt'])
export class ChannelStorageLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id', type: 'varchar' })
  threadId: string;

  @Column({ type: 'varchar' })
  kind: ChannelStorageLinkKind;

  /** Null for links backfilled from thread configs, whose Google account was never recorded. */
  @Column({ name: 'google_email', type: 'varchar', nullable: true })
  googleEmail?: string | null;

  /** Drive folder id or Photos album id (the URL for legacy rows that never stored an id). */
  @Column({ name: 'resource_id', type: 'varchar' })
  resourceId: string;

  @Column({ type: 'varchar' })
  url: string;

  /** Drive folder path or Photos album title. */
  @Column({ type: 'varchar', default: '' })
  label: string;

  /** Name an admin gave the link; uploads never rewrite it (unlike `label`). */
  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName?: string | null;

  @Column({ name: 'first_used_at', type: 'timestamptz' })
  firstUsedAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt: Date;
}
