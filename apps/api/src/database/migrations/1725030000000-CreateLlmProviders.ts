import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { encryptSecret, parseEncryptionKey } from '../../common/crypto/secret-cipher';
import { buildLlmProviderSeed, readEnvValue } from '../../llm/llm-provider-seed';

/**
 * Moves the LLM provider chain from env into the database so admins edit it on the dashboard.
 * An empty table is seeded once from the env the bot ran with (`LLM_PROVIDER`,
 * `LLM_FALLBACK_PROVIDERS`, `GEMINI_*`, `ROUTER_*`, `OPENAI_*`, `QWEN_*`), so a deploy keeps
 * today's chain. No secret is written in this file: keys come from env and are stored encrypted.
 */
export class CreateLlmProviders1725030000000 implements MigrationInterface {
  name = 'CreateLlmProviders1725030000000';

  private readonly logger = new Logger(CreateLlmProviders1725030000000.name);

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "llm_providers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(60) NOT NULL,
        "kind" varchar(20) NOT NULL,
        "base_url" text NULL,
        "model" varchar(200) NOT NULL,
        "api_key" text NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_llm_providers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_llm_providers_name" UNIQUE ("name")
      )
    `);

    const existing = (await queryRunner.query(
      `SELECT COUNT(*)::int AS "count" FROM "llm_providers"`,
    )) as Array<{ count: number }>;
    if ((existing[0]?.count ?? 0) > 0) return;

    // Same default as `configuration.ts`, so the app later decrypts with the same key.
    const key = parseEncryptionKey(
      readEnvValue(process.env, 'DATA_ENCRYPTION_KEY') || '0'.repeat(64),
    );
    const rows = buildLlmProviderSeed(process.env);
    for (const [position, row] of rows.entries()) {
      if (row.apiKey && !key) {
        this.logger.warn(
          `DATA_ENCRYPTION_KEY is invalid: the API key of LLM provider "${row.name}" was not copied, enter it on the dashboard.`,
        );
      }
      const apiKey = row.apiKey && key ? (encryptSecret(row.apiKey, key) ?? null) : null;
      await queryRunner.query(
        `INSERT INTO "llm_providers" ("name", "kind", "base_url", "model", "api_key", "enabled", "position")
         VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [row.name, row.kind, row.baseUrl, row.model, apiKey, position],
      );
    }
    this.logger.log(
      `Seeded ${rows.length} LLM provider(s) from env: ${rows.map((row) => row.name).join(' -> ')}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "llm_providers"`);
  }
}
