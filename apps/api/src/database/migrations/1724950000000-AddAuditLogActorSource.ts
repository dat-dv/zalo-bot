import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit rows now record who caused the change (`actor_source` + `actor_id`) and the Zalo chat
 * it came from. Older rows keep `actor_source` NULL: their `actor_id` was copied from the row's
 * creator, so the real actor cannot be recovered and is not backfilled.
 * `created_at` gets an index for the newest-first activity log.
 */
export class AddAuditLogActorSource1724950000000 implements MigrationInterface {
  name = 'AddAuditLogActorSource1724950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_source" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "channel_id" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at" ON "audit_logs" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "channel_id"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "actor_source"`);
  }
}
