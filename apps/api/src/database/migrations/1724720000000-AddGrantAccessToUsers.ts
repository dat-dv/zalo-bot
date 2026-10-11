import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGrantAccessToUsers1724720000000 implements MigrationInterface {
  name = 'AddGrantAccessToUsers1724720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "grant_access" integer NOT NULL DEFAULT 0`,
    );
    // Ensure all existing admin users automatically have grant_access = 1
    await queryRunner.query(`UPDATE "users" SET "grant_access" = 1 WHERE "role" = 'admin'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "grant_access"`);
  }
}
