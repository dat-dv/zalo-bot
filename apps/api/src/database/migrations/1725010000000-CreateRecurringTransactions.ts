import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fixed income and expenses (`recurring_transactions`) and their periods (`recurring_occurrences`). */
export class CreateRecurringTransactions1725010000000 implements MigrationInterface {
  name = 'CreateRecurringTransactions1725010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recurring_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL,
        "amount" integer,
        "category" character varying NOT NULL DEFAULT 'Khác',
        "note" character varying NOT NULL,
        "place_id" uuid,
        "repeat_type" character varying NOT NULL,
        "repeat_weekdays" jsonb NOT NULL DEFAULT '[]',
        "anchor_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "next_due_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "mode" character varying NOT NULL,
        "notify_chat_id" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by_user_id" character varying,
        "created_by_name" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recurring_transactions_place" FOREIGN KEY ("place_id")
          REFERENCES "finance_places" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_transactions_next_due" ON "recurring_transactions" ("next_due_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recurring_occurrences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "rule_id" uuid NOT NULL,
        "due_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "amount" integer,
        "status" character varying NOT NULL DEFAULT 'due',
        "transaction_id" uuid,
        "notified_at" TIMESTAMP WITH TIME ZONE,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_occurrences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_recurring_occurrences_rule_due" UNIQUE ("rule_id", "due_at"),
        CONSTRAINT "FK_recurring_occurrences_rule" FOREIGN KEY ("rule_id")
          REFERENCES "recurring_transactions" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_occurrences_status" ON "recurring_occurrences" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_occurrences_notified" ON "recurring_occurrences" ("notified_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_occurrences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_transactions"`);
  }
}
