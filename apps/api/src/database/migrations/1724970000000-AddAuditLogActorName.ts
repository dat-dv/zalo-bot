import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit rows keep the Zalo display name the sender had when the change was made, because group
 * members who are not the bot's friends are missing from the ZCA directory and often have no
 * `users.first_name`. Older rows stay NULL: the name at that time is unknown.
 */
export class AddAuditLogActorName1724970000000 implements MigrationInterface {
  name = 'AddAuditLogActorName1724970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_name" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "actor_name"`);
  }
}
