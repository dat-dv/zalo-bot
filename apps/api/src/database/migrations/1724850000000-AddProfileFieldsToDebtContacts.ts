import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Profile fields of a debt contact (the Profile page). The primary phone / bank account stay in
 * their existing columns so the bot and the phone backup keep working; extra ones are short
 * lists always read with the contact, hence jsonb instead of a child table.
 */
export class AddProfileFieldsToDebtContacts1724850000000 implements MigrationInterface {
  name = 'AddProfileFieldsToDebtContacts1724850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "notes" text`);
    await queryRunner.query(`ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "birthday" date`);
    await queryRunner.query(
      `ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "address" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "workplace" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "relationship" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "extra_phones" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_contacts" ADD COLUMN IF NOT EXISTS "extra_bank_accounts" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'extra_bank_accounts',
      'extra_phones',
      'relationship',
      'workplace',
      'address',
      'birthday',
      'notes',
    ]) {
      await queryRunner.query(`ALTER TABLE "debt_contacts" DROP COLUMN IF EXISTS "${column}"`);
    }
  }
}
