import { MigrationInterface, QueryRunner } from 'typeorm';

/** `webhook_recipients`: chats the webhook may message, picked in Settings → Webhook. */
export class CreateWebhookRecipients1725000000000 implements MigrationInterface {
  name = 'CreateWebhookRecipients1725000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_recipients" (
        "thread_id" character varying NOT NULL,
        "thread_name" character varying,
        "thread_type" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_recipients" PRIMARY KEY ("thread_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_recipients"`);
  }
}
