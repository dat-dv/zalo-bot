import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The bot no longer reads un-mentioned group messages, so the per-thread passive tracking flags
 * (`expense_tracking`, `calendar_extraction`) have nothing left to control. `requireMention` is
 * dropped from `direct_interaction` for the same reason: groups always need a mention or prefix.
 */
export class DropZcaPassiveTrackingColumns1724800000000 implements MigrationInterface {
  name = 'DropZcaPassiveTrackingColumns1724800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "zca_thread_configs" DROP COLUMN IF EXISTS "expense_tracking"`,
    );
    await queryRunner.query(
      `ALTER TABLE "zca_thread_configs" DROP COLUMN IF EXISTS "calendar_extraction"`,
    );
    await queryRunner.query(
      `UPDATE "zca_thread_configs" SET "direct_interaction" = "direct_interaction" - 'requireMention'`,
    );
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs" ALTER COLUMN "direct_interaction"
      SET DEFAULT '{"enabled": false, "triggerPrefixes": [], "allowAiChat": false, "allowSelf": false}'
    `);
  }

  /** Restores the columns with their defaults; the previous per-thread values are not recoverable. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "expense_tracking" jsonb NOT NULL
      DEFAULT '{"enabled": false, "requireConfirm": false}'
    `);
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "calendar_extraction" jsonb NOT NULL
      DEFAULT '{"enabled": false, "requireConfirm": false}'
    `);
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs" ALTER COLUMN "direct_interaction"
      SET DEFAULT '{"enabled": false, "requireMention": false, "allowAiChat": false, "allowSelf": false}'
    `);
  }
}
