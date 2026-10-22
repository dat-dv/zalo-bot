import type { CalendarEventSource, CalendarSyncStatus } from '@zalobot/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A calendar event owned by the system. Like the finance ledger, the calendar is shared:
 * everyone sees every event, and the creator and source chat are recorded for display.
 * Google Calendar only holds a copy (`google_event_id` in `google_account_email`), so
 * switching Google accounts never loses events.
 */
@Entity('calendar_events')
@Index('IDX_calendar_events_google_copy', ['googleAccountEmail', 'googleEventId'], {
  unique: true,
  where: '"google_event_id" IS NOT NULL',
})
export class CalendarEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', nullable: true })
  location?: string | null;

  @Index('IDX_calendar_events_start_at')
  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  /** Exclusive; for all-day events, midnight after the last day (Google's convention). */
  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ name: 'all_day', type: 'boolean', default: false })
  allDay: boolean;

  @Column({ name: 'time_zone', type: 'varchar' })
  timeZone: string;

  @Column({ name: 'reminder_minutes', type: 'jsonb', default: () => `'[]'` })
  reminderMinutes: number[];

  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId?: string | null;

  /** Name snapshot for creators without a users row; the current profile name wins on display. */
  @Column({ name: 'created_by_name', type: 'varchar', nullable: true })
  createdByName?: string | null;

  @Column({ type: 'varchar' })
  source: CalendarEventSource;

  @Column({ name: 'source_chat_id', type: 'varchar', nullable: true })
  sourceChatId?: string | null;

  @Column({ name: 'google_event_id', type: 'varchar', nullable: true })
  googleEventId?: string | null;

  @Column({ name: 'google_account_email', type: 'varchar', nullable: true })
  googleAccountEmail?: string | null;

  @Column({ name: 'sync_status', type: 'varchar' })
  syncStatus: CalendarSyncStatus;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt?: Date | null;

  @Index('IDX_calendar_events_deleted_at')
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
