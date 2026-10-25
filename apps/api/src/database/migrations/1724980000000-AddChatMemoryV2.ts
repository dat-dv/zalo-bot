import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat memory v2:
 * - `zca_messages.memory_kind` says which memories may use a row (confirmation cards and system
 *   notices no longer crowd the short-term window); `expires_at` marks rows kept only for the
 *   short-term memory of a thread whose long-term memory is off.
 * - `zca_channel_notes`: what members told the bot to always remember (Ghi nhớ).
 * - `zca_learned_facts`: what the nightly job learned about the bot and members; deleted rows are
 *   kept so they are not learned again.
 * - `zca_memory_ingestions`: one row per channel and day sent to Cognee.
 */
export class AddChatMemoryV21724980000000 implements MigrationInterface {
  name = 'AddChatMemoryV21724980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "zca_messages" ADD COLUMN IF NOT EXISTS "memory_kind" character varying NOT NULL DEFAULT 'chat'`,
    );
    await queryRunner.query(
      `ALTER TABLE "zca_messages" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "zca_messages" SET "memory_kind" = 'bot_chat' WHERE "is_bot" = true AND "memory_kind" = 'chat'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_messages_expires_at" ON "zca_messages" ("expires_at") WHERE "expires_at" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_channel_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" character varying NOT NULL,
        "text" character varying(200) NOT NULL,
        "created_by" character varying,
        "source_msg_id" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zca_channel_notes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_channel_notes_channel" ON "zca_channel_notes" ("channel_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_learned_facts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" character varying NOT NULL,
        "subject_kind" character varying NOT NULL,
        "subject_user_id" character varying,
        "subject_name" character varying NOT NULL,
        "fact" character varying(300) NOT NULL,
        "learned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" character varying,
        CONSTRAINT "PK_zca_learned_facts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_learned_facts_channel" ON "zca_learned_facts" ("channel_id", "subject_kind", "subject_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_memory_ingestions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" character varying NOT NULL,
        "day" date NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "cognee_data_id" character varying,
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "ingested_at" TIMESTAMP WITH TIME ZONE,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zca_memory_ingestions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zca_memory_ingestions_channel_day" UNIQUE ("channel_id", "day")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_memory_ingestions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_learned_facts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_channel_notes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zca_messages_expires_at"`);
    await queryRunner.query(`ALTER TABLE "zca_messages" DROP COLUMN IF EXISTS "expires_at"`);
    await queryRunner.query(`ALTER TABLE "zca_messages" DROP COLUMN IF EXISTS "memory_kind"`);
  }
}
