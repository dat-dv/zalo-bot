import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shared ledger: at most one user is the ledger owner that every sender's finance data is recorded
 * under. Transactions also remember who created them and from which chat.
 */
export class AddSharedLedgerAndTransactionCreator1724780000000 implements MigrationInterface {
  name = 'AddSharedLedgerAndTransactionCreator1724780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_ledger_owner" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_single_ledger_owner"
      ON "users" ("is_ledger_owner") WHERE "is_ledger_owner" = true
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_transactions"
      ADD COLUMN IF NOT EXISTS "created_by_user_id" character varying,
      ADD COLUMN IF NOT EXISTS "created_by_name" character varying,
      ADD COLUMN IF NOT EXISTS "source" character varying,
      ADD COLUMN IF NOT EXISTS "source_chat_id" character varying
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_finance_transactions_created_by_user_id"
      ON "finance_transactions" ("created_by_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_finance_transactions_created_by_user_id"`);
    await queryRunner.query(`
      ALTER TABLE "finance_transactions"
      DROP COLUMN IF EXISTS "created_by_user_id",
      DROP COLUMN IF EXISTS "created_by_name",
      DROP COLUMN IF EXISTS "source",
      DROP COLUMN IF EXISTS "source_chat_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_single_ledger_owner"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_ledger_owner"`);
  }
}
