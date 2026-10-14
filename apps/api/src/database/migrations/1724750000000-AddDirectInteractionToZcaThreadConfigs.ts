import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectInteractionToZcaThreadConfigs1724750000000 implements MigrationInterface {
  name = 'AddDirectInteractionToZcaThreadConfigs1724750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "direct_interaction" jsonb NOT NULL DEFAULT '{"enabled": true, "requireMention": false, "allowAiChat": true}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      DROP COLUMN IF EXISTS "direct_interaction"
    `);
  }
}
