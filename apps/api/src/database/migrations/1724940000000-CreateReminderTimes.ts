import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Several reminder times per task and per personal reminder: one row per time, each sent
 * once. The parents keep `remind_at` as the next time not sent yet. Existing reminders become
 * one row each: a task's `reminded_at` (or a finished reminder's `completed_at`) marks it sent.
 * `reminder_times` uses `timestamp` like `reminders.remind_at`, so the copy is exact.
 */
export class CreateReminderTimes1724940000000 implements MigrationInterface {
  name = 'CreateReminderTimes1724940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_reminder_times" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "task_id" uuid NOT NULL,
        "remind_at" timestamptz NOT NULL,
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_reminder_times" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_reminder_times_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_reminder_times_task_id" ON "task_reminder_times" ("task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_reminder_times_due" ON "task_reminder_times" ("sent_at", "remind_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reminder_times" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reminder_id" uuid NOT NULL,
        "remind_at" timestamp NOT NULL,
        "sent_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminder_times" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reminder_times_reminder" FOREIGN KEY ("reminder_id")
          REFERENCES "reminders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reminder_times_reminder_id" ON "reminder_times" ("reminder_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reminder_times_due" ON "reminder_times" ("sent_at", "remind_at")`,
    );

    // Existing reminders: one time each, carrying over whether it already went out.
    await queryRunner.query(`
      INSERT INTO "task_reminder_times" ("task_id", "remind_at", "sent_at")
      SELECT t."id", t."remind_at", t."reminded_at"
      FROM "tasks" t
      WHERE t."remind_at" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "task_reminder_times" x WHERE x."task_id" = t."id")
    `);
    await queryRunner.query(`
      INSERT INTO "reminder_times" ("reminder_id", "remind_at", "sent_at")
      SELECT r."id", r."remind_at",
        CASE WHEN r."is_triggered" THEN COALESCE(r."completed_at", r."remind_at") ELSE NULL END
      FROM "reminders" r
      WHERE NOT EXISTS (SELECT 1 FROM "reminder_times" x WHERE x."reminder_id" = r."id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The parents still hold `remind_at`, so dropping the times keeps one time per row.
    await queryRunner.query(`DROP TABLE IF EXISTS "reminder_times"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_reminder_times"`);
  }
}
