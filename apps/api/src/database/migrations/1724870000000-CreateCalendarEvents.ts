import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Calendar events used to live only in Google Calendar, so switching the Google account made
 * them disappear. They now live here; Google keeps a copy keyed by (account email, event id).
 * Rows are soft-deleted (`deleted_at`) so a later import from Google cannot resurrect them.
 */
export class CreateCalendarEvents1724870000000 implements MigrationInterface {
  name = 'CreateCalendarEvents1724870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "description" text,
        "location" varchar,
        "start_at" timestamptz NOT NULL,
        "end_at" timestamptz NOT NULL,
        "all_day" boolean NOT NULL DEFAULT false,
        "time_zone" varchar NOT NULL,
        "reminder_minutes" jsonb NOT NULL DEFAULT '[]',
        "created_by_user_id" varchar,
        "created_by_name" varchar,
        "source" varchar NOT NULL,
        "source_chat_id" varchar,
        "google_event_id" varchar,
        "google_account_email" varchar,
        "sync_status" varchar NOT NULL,
        "synced_at" timestamptz,
        "deleted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_calendar_events_start_at" ON "calendar_events" ("start_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_calendar_events_deleted_at" ON "calendar_events" ("deleted_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_calendar_events_google_copy" ON "calendar_events" ("google_account_email", "google_event_id") WHERE "google_event_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_events"`);
  }
}
