import { MigrationInterface, QueryRunner } from 'typeorm';

/** `zca_memory_segments`: parts of today's chat sent to Cognee before the nightly job. */
export class AddChatMemorySegments1724990000000 implements MigrationInterface {
  name = 'AddChatMemorySegments1724990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zca_memory_segments_channel_day"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zca_memory_segments"`);
  }
}
