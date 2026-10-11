import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropInvitesTable1724710000000 implements MigrationInterface {
  name = 'DropInvitesTable1724710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invites" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invites" (
        "code" character varying NOT NULL,
        "createdBy" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" character varying NOT NULL,
        "usedBy" character varying,
        "usedAt" character varying,
        CONSTRAINT "PK_invites_code" PRIMARY KEY ("code")
      )
    `);
  }
}
