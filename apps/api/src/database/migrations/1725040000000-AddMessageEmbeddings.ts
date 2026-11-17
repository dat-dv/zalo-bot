import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Long-term memory without Cognee:
 * - `vector` extension (pgvector, built into the project's Postgres image) and
 *   `zca_message_embeddings`: one MiniLM embedding (384 dimensions) per message that may be a
 *   memory hit, computed inside the API. No entity: TypeORM has no vector type, the rows are read
 *   and written with SQL. No HNSW index: searches are scoped to one chat (a few thousand rows),
 *   an exact scan is fast and never drops filtered matches.
 * - Drops `zca_memory_segments` and `zca_memory_ingestions`, which only tracked what was sent to
 *   Cognee. The messages themselves stay in `zca_messages`.
 */
export class AddMessageEmbeddings1725040000000 implements MigrationInterface {
  name = 'AddMessageEmbeddings1725040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_message_embeddings" (
        "message_id" uuid NOT NULL,
        "channel_id" character varying NOT NULL,
        "embedding" vector(384) NOT NULL,
        "model" character varying(120) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zca_message_embeddings" PRIMARY KEY ("message_id"),
        CONSTRAINT "FK_zca_message_embeddings_message" FOREIGN KEY ("message_id")
          REFERENCES "zca_messages"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_message_embeddings_channel" ON "zca_message_embeddings" ("channel_id", "model")`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_memory_segments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_memory_ingestions"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zca_memory_segments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" character varying NOT NULL,
        "day" date NOT NULL,
        "from_sent_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "to_sent_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "cognee_data_id" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zca_memory_segments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zca_memory_segments_channel_day" ON "zca_memory_segments" ("channel_id", "day")`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_message_embeddings"`);
  }
}
