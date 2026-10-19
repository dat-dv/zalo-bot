import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotosAlbumColumnsToZcaThreadConfigs1724770000000 implements MigrationInterface {
  name = 'AddPhotosAlbumColumnsToZcaThreadConfigs1724770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      ADD COLUMN IF NOT EXISTS "photos_album_id" character varying,
      ADD COLUMN IF NOT EXISTS "photos_album_url" character varying,
      ADD COLUMN IF NOT EXISTS "photos_album_title" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zca_thread_configs"
      DROP COLUMN IF EXISTS "photos_album_id",
      DROP COLUMN IF EXISTS "photos_album_url",
      DROP COLUMN IF EXISTS "photos_album_title"
    `);
  }
}
