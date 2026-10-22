import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin-chosen name of a channel storage link. Kept apart from `label` (folder path / album
 * title), which every upload rewrites, so an edited name survives later uploads.
 */
export class AddDisplayNameToChannelStorageLinks1724840000000 implements MigrationInterface {
  name = 'AddDisplayNameToChannelStorageLinks1724840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_storage_links" ADD COLUMN IF NOT EXISTS "display_name" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_storage_links" DROP COLUMN IF EXISTS "display_name"`,
    );
  }
}
