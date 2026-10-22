import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reminder targets shared by task reminders and personal reminders: the people of the group
 * to remind (`remind_users`, `[{ id, name }]`) and how (`remind_mode`: tag them in the group
 * or message each privately). Personal reminders also get a chat (`chat_id`); NULL keeps the
 * old behaviour of messaging the owner (`user_id`) privately.
 */
export class AddReminderTargets1724930000000 implements MigrationInterface {
  name = 'AddReminderTargets1724930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "remind_users" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "remind_mode" varchar NOT NULL DEFAULT 'mention'
    `);
    await queryRunner.query(`
      ALTER TABLE "reminders"
        ADD COLUMN IF NOT EXISTS "chat_id" varchar,
        ADD COLUMN IF NOT EXISTS "remind_users" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "remind_mode" varchar NOT NULL DEFAULT 'mention'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reminders"
        DROP COLUMN IF EXISTS "chat_id",
        DROP COLUMN IF EXISTS "remind_users",
        DROP COLUMN IF EXISTS "remind_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "remind_users",
        DROP COLUMN IF EXISTS "remind_mode"
    `);
  }
}
