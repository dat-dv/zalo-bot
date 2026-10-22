import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat memory is switched per thread (dashboard thread config) instead of the former global
 * `CHAT_MEMORY_*` env vars. Off by default: an admin enables it for each thread to remember.
 */
export class AddChatMemoryToZcaThreadConfigs1724820000000 implements MigrationInterface {
  name = 'AddChatMemoryToZcaThreadConfigs1724820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "chat_memory" jsonb NOT NULL
      DEFAULT '{"enabled": false, "contextWindow": 10, "searchLimit": 15}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "zca_thread_configs" DROP COLUMN IF EXISTS "chat_memory"`);
  }
}
