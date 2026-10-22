import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sign-in code sent by the bot next to the one-time dashboard link. The installed app (PWA) on
 * iOS has its own storage, so a link opened from Zalo never reaches it; typing the code does.
 * Nullable because rows issued before this change only have the link.
 */
export class AddCodeHashToDashboardExchangeTokens1724860000000 implements MigrationInterface {
  name = 'AddCodeHashToDashboardExchangeTokens1724860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dashboard_exchange_tokens" ADD COLUMN IF NOT EXISTS "code_hash" varchar`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dashboard_exchange_tokens_code_hash" ON "dashboard_exchange_tokens" ("code_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dashboard_exchange_tokens_code_hash"`);
    await queryRunner.query(
      `ALTER TABLE "dashboard_exchange_tokens" DROP COLUMN IF EXISTS "code_hash"`,
    );
  }
}
