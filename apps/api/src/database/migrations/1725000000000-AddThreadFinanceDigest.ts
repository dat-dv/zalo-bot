import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-channel switches for the scheduled finance digest; off because it shows the shared ledger. */
export class AddThreadFinanceDigest1725000000000 implements MigrationInterface {
  name = 'AddThreadFinanceDigest1725000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "finance_digest" jsonb NOT NULL
      DEFAULT '{"weekly": false, "monthly": false}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "zca_thread_configs" DROP COLUMN IF EXISTS "finance_digest"`,
    );
  }
}
