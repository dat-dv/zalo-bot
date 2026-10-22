import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tasks stay inside zalobot: no Google Tasks copy and no import from Google any more
 * (the Tasks API drops the time of a due date, so a copy never reminded anyone on time).
 * Drops the copy-tracking columns added by CreateTasks. Rows imported from Google before
 * this change are kept as ordinary dashboard tasks.
 */
export class DropTaskGoogleCopy1724890000000 implements MigrationInterface {
  name = 'DropTaskGoogleCopy1724890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_google_copy"`);
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "google_task_id",
        DROP COLUMN IF EXISTS "google_task_list_id",
        DROP COLUMN IF EXISTS "google_account_email",
        DROP COLUMN IF EXISTS "sync_status",
        DROP COLUMN IF EXISTS "synced_at"
    `);
    await queryRunner.query(`UPDATE "tasks" SET "source" = 'dashboard' WHERE "source" = 'google'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "google_task_id" varchar,
        ADD COLUMN IF NOT EXISTS "google_task_list_id" varchar,
        ADD COLUMN IF NOT EXISTS "google_account_email" varchar,
        ADD COLUMN IF NOT EXISTS "sync_status" varchar NOT NULL DEFAULT 'local',
        ADD COLUMN IF NOT EXISTS "synced_at" timestamptz
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tasks_google_copy" ON "tasks" ("google_account_email", "google_task_id") WHERE "google_task_id" IS NOT NULL`,
    );
  }
}
