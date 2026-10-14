import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateZcaThreadConfigs1724740000000 implements MigrationInterface {
  name = 'CreateZcaThreadConfigs1724740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_thread_configs" (
        "thread_id" character varying NOT NULL,
        "thread_name" character varying,
        "thread_type" character varying NOT NULL DEFAULT 'user',
        "is_listened" boolean NOT NULL DEFAULT false,
        "media_backup" jsonb NOT NULL DEFAULT '{}',
        "expense_tracking" jsonb NOT NULL DEFAULT '{}',
        "calendar_extraction" jsonb NOT NULL DEFAULT '{}',
        "confirmation_rules" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zca_thread_configs_thread_id" PRIMARY KEY ("thread_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zca_thread_configs_is_listened" ON "zca_thread_configs" ("is_listened")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zca_thread_configs_is_listened"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_thread_configs"`);
  }
}
