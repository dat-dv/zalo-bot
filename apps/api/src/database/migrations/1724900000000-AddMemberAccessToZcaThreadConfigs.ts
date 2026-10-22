import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-thread member access (who may call the bot in a group), added on top of the global
 * `users.grant_access`. Defaults to `granted-users`, so existing threads keep the global rule.
 */
export class AddMemberAccessToZcaThreadConfigs1724900000000 implements MigrationInterface {
  name = 'AddMemberAccessToZcaThreadConfigs1724900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "member_access" jsonb NOT NULL
      DEFAULT '{"mode": "granted-users", "memberIds": []}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "zca_thread_configs" DROP COLUMN IF EXISTS "member_access"`,
    );
  }
}
