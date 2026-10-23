import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repeat per reminder time, and "remind again" per task / reminder.
 *
 * - Each time row (`task_reminder_times`, `reminder_times`) gets its own repeat
 *   (`repeat_type`, `repeat_weekdays`), `anchor_at` (the time as first set, for monthly
 *   repeats), `nag_at` (when to remind again next) and `nag_left`.
 * - `tasks` and `reminders` get the shared remind-again rule (`nag_every_minutes`,
 *   `nag_count`).
 * - A reminder's existing `repeat_type` (`daily` / `weekly`) is copied to each of its times,
 *   so repeating reminders go on exactly as before. `reminders.repeat_type` stays as a legacy
 *   column (the repeat of the earliest time).
 *
 * Time columns follow the `remind_at` type of their table.
 */
export class AddReminderRepeatAndNag1724960000000 implements MigrationInterface {
  name = 'AddReminderRepeatAndNag1724960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "nag_every_minutes" integer,
        ADD COLUMN IF NOT EXISTS "nag_count" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "reminders"
        ADD COLUMN IF NOT EXISTS "nag_every_minutes" integer,
        ADD COLUMN IF NOT EXISTS "nag_count" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "task_reminder_times"
        ADD COLUMN IF NOT EXISTS "repeat_type" varchar NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS "repeat_weekdays" smallint[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "anchor_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "nag_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "nag_left" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "reminder_times"
        ADD COLUMN IF NOT EXISTS "repeat_type" varchar NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS "repeat_weekdays" smallint[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "anchor_at" timestamp,
        ADD COLUMN IF NOT EXISTS "nag_at" timestamp,
        ADD COLUMN IF NOT EXISTS "nag_left" integer NOT NULL DEFAULT 0
    `);
    // Repeating reminders: every time repeats as its reminder did.
    await queryRunner.query(`
      UPDATE "reminder_times" t
      SET "repeat_type" = r."repeat_type"
      FROM "reminders" r
      WHERE t."reminder_id" = r."id" AND r."repeat_type" IN ('daily', 'weekly')
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_reminder_times_nag_at" ON "task_reminder_times" ("nag_at") WHERE "nag_at" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reminder_times_nag_at" ON "reminder_times" ("nag_at") WHERE "nag_at" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reminder_times_nag_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_task_reminder_times_nag_at"`);
    // The old code has one repeat per reminder and knows only daily / weekly: keep the repeat
    // of the earliest time, anything else becomes "no repeat".
    await queryRunner.query(`
      UPDATE "reminders" r
      SET "repeat_type" = CASE WHEN first."repeat_type" IN ('daily', 'weekly')
                               THEN first."repeat_type" ELSE 'none' END
      FROM (
        SELECT DISTINCT ON ("reminder_id") "reminder_id", "repeat_type"
        FROM "reminder_times"
        ORDER BY "reminder_id", "remind_at"
      ) first
      WHERE first."reminder_id" = r."id"
    `);
    await queryRunner.query(`
      ALTER TABLE "reminder_times"
        DROP COLUMN IF EXISTS "nag_left",
        DROP COLUMN IF EXISTS "nag_at",
        DROP COLUMN IF EXISTS "anchor_at",
        DROP COLUMN IF EXISTS "repeat_weekdays",
        DROP COLUMN IF EXISTS "repeat_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "task_reminder_times"
        DROP COLUMN IF EXISTS "nag_left",
        DROP COLUMN IF EXISTS "nag_at",
        DROP COLUMN IF EXISTS "anchor_at",
        DROP COLUMN IF EXISTS "repeat_weekdays",
        DROP COLUMN IF EXISTS "repeat_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "reminders"
        DROP COLUMN IF EXISTS "nag_count",
        DROP COLUMN IF EXISTS "nag_every_minutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "nag_count",
        DROP COLUMN IF EXISTS "nag_every_minutes"
    `);
  }
}
