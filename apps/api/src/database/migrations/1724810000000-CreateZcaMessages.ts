import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat memory: every message of a listened ZCA thread is kept so the bot can answer questions
 * about past conversations. Search is full-text over accent-stripped text (`simple` config, since
 * Postgres has no Vietnamese dictionary), so "da lat" matches "Đà Lạt". `unaccent()` is only
 * STABLE, which generated columns reject, hence the IMMUTABLE wrapper pinned to the default
 * dictionary.
 */
export class CreateZcaMessages1724810000000 implements MigrationInterface {
  name = 'CreateZcaMessages1724810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION zalobot_unaccent(text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
      AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" varchar NOT NULL,
        "channel_type" varchar NOT NULL DEFAULT 'user',
        "msg_id" varchar NOT NULL,
        "cli_msg_id" varchar,
        "sender_uid" varchar NOT NULL DEFAULT '',
        "sender_name" varchar,
        "is_bot" boolean NOT NULL DEFAULT false,
        "msg_type" varchar NOT NULL DEFAULT 'webchat',
        "text" text,
        "content" jsonb,
        "quote_msg_id" varchar,
        "sent_at" timestamptz NOT NULL,
        "recalled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "search_vector" tsvector GENERATED ALWAYS AS (
          to_tsvector('simple', zalobot_unaccent(coalesce("text", '')))
        ) STORED,
        CONSTRAINT "PK_zca_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zca_messages_channel_msg" UNIQUE ("channel_id", "msg_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_messages_channel_sent_at" ON "zca_messages" ("channel_id", "sent_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_messages_search_vector" ON "zca_messages" USING GIN ("search_vector")`,
    );
  }

  /** Keeps the `unaccent` extension: other objects may depend on it. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_messages"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS zalobot_unaccent(text)`);
  }
}
