import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedUserIdToDebtContacts1724730000000 implements MigrationInterface {
  name = 'AddLinkedUserIdToDebtContacts1724730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "linked_user_id" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_debt_contacts_linked_user_id" ON "debt_contacts" ("linked_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debt_contacts_linked_user_id"`);
    await queryRunner.query(`ALTER TABLE "debt_contacts" DROP COLUMN IF EXISTS "linked_user_id"`);
  }
}
