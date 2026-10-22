import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tasks used to live only in Google Tasks, so switching the Google account made them
 * disappear. They now live here; Google keeps a copy keyed by (account email, task id).
 * Rows are soft-deleted (`deleted_at`) so a later import from Google cannot resurrect them.
 */
export class CreateTasks1724880000000 implements MigrationInterface {
  name = 'CreateTasks1724880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "notes" text,
        "due_at" timestamptz,
        "status" varchar NOT NULL,
        "completed_at" timestamptz,
        "created_by_user_id" varchar,
        "created_by_name" varchar,
        "source" varchar NOT NULL,
        "source_chat_id" varchar,
        "google_task_id" varchar,
        "google_task_list_id" varchar,
        "google_account_email" varchar,
        "sync_status" varchar NOT NULL,
        "synced_at" timestamptz,
        "deleted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_status_due_at" ON "tasks" ("status", "due_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_deleted_at" ON "tasks" ("deleted_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tasks_google_copy" ON "tasks" ("google_account_email", "google_task_id") WHERE "google_task_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
  }
}
