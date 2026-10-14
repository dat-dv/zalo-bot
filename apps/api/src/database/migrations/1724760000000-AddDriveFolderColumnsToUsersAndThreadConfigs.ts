import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriveFolderColumnsToUsersAndThreadConfigs1724760000000 implements MigrationInterface {
  name = 'AddDriveFolderColumnsToUsersAndThreadConfigs1724760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "drive_folder_id" character varying,
      ADD COLUMN IF NOT EXISTS "drive_folder_url" character varying,
      ADD COLUMN IF NOT EXISTS "drive_folder_path" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "drive_folder_id" character varying,
      ADD COLUMN IF NOT EXISTS "drive_folder_url" character varying,
      ADD COLUMN IF NOT EXISTS "drive_folder_path" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "drive_folder_id",
      DROP COLUMN IF EXISTS "drive_folder_url",
      DROP COLUMN IF EXISTS "drive_folder_path"
    `);

    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      DROP COLUMN IF EXISTS "drive_folder_id",
      DROP COLUMN IF EXISTS "drive_folder_url",
      DROP COLUMN IF EXISTS "drive_folder_path"
    `);
  }
}
