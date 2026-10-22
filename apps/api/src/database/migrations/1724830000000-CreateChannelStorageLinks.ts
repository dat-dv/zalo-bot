import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Channel storage history: every Drive root folder / Photos album a channel used, kept after the
 * shared Google account changes. Backfills the single link each thread config held so far (its
 * Google account is unknown, hence `google_email` NULL).
 *
 * `user_tokens.is_shared` pins which token is the shared storage account. Before, the shared
 * account was whichever token was saved last — including hourly refreshes of any admin's token —
 * so media flipped between Google accounts. The most recently updated token is marked.
 */
export class CreateChannelStorageLinks1724830000000 implements MigrationInterface {
  name = 'CreateChannelStorageLinks1724830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_storage_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "thread_id" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "google_email" varchar,
        "resource_id" varchar NOT NULL,
        "url" varchar NOT NULL,
        "label" varchar NOT NULL DEFAULT '',
        "first_used_at" timestamptz NOT NULL,
        "last_used_at" timestamptz NOT NULL,
        CONSTRAINT "PK_channel_storage_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_channel_storage_links_resource" UNIQUE ("thread_id", "kind", "resource_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_channel_storage_links_thread_kind" ON "channel_storage_links" ("thread_id", "kind", "last_used_at")`,
    );

    await queryRunner.query(`
      INSERT INTO "channel_storage_links"
        ("thread_id", "kind", "resource_id", "url", "label", "first_used_at", "last_used_at")
      SELECT "thread_id", 'drive', COALESCE("drive_folder_id", "drive_folder_url"), "drive_folder_url",
             COALESCE("drive_folder_path", ''), "updated_at", "updated_at"
      FROM "zca_thread_configs"
      WHERE "drive_folder_url" IS NOT NULL AND "drive_folder_url" <> ''
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "channel_storage_links"
        ("thread_id", "kind", "resource_id", "url", "label", "first_used_at", "last_used_at")
      SELECT "thread_id", 'photos', COALESCE("photos_album_id", "photos_album_url"), "photos_album_url",
             COALESCE("photos_album_title", ''), "updated_at", "updated_at"
      FROM "zca_thread_configs"
      WHERE "photos_album_url" IS NOT NULL AND "photos_album_url" <> ''
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(
      `ALTER TABLE "user_tokens" ADD COLUMN IF NOT EXISTS "is_shared" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      UPDATE "user_tokens" SET "is_shared" = true
      WHERE "userId" = (SELECT "userId" FROM "user_tokens" ORDER BY "updatedAt" DESC LIMIT 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_tokens" DROP COLUMN IF EXISTS "is_shared"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_storage_links"`);
  }
}
