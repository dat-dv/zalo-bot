import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-off reminders on tasks: the bot posts the task into `remind_chat_id` at `remind_at`
 * while the task is still open. `reminded_at` marks it sent so the scheduler never repeats it.
 */
export class AddReminderToTasks1724910000000 implements MigrationInterface {
  name = 'AddReminderToTasks1724910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "remind_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "remind_chat_id" varchar,
        ADD COLUMN IF NOT EXISTS "reminded_at" timestamptz
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_status_remind_at" ON "tasks" ("status", "remind_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_status_remind_at"`);
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "remind_at",
        DROP COLUMN IF EXISTS "remind_chat_id",
        DROP COLUMN IF EXISTS "reminded_at"
    `);
  }
}
