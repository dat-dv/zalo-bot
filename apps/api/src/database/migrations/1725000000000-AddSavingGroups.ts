import { MigrationInterface, QueryRunner } from 'typeorm';

/** Savings groups: money moved out of the wallet balance, without counting as an expense. */
export class AddSavingGroups1725000000000 implements MigrationInterface {
  name = 'AddSavingGroups1725000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saving_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "normalized_name" character varying NOT NULL,
        "note" character varying,
        "archived_at" TIMESTAMP WITH TIME ZONE,
        "created_by_user_id" character varying,
        "created_by_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_saving_groups_normalized_name" UNIQUE ("normalized_name"),
        CONSTRAINT "PK_saving_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "saving_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "amount" integer NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "note" character varying,
        "created_by_user_id" character varying,
        "created_by_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_saving_movements_amount" CHECK ("amount" > 0),
        CONSTRAINT "CHK_saving_movements_type" CHECK ("type" IN ('deposit', 'withdrawal', 'opening')),
        CONSTRAINT "PK_saving_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saving_movements_group" FOREIGN KEY ("group_id")
          REFERENCES "saving_groups" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saving_movements_group_id" ON "saving_movements" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_saving_movements_occurred_at" ON "saving_movements" ("occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_saving_movements_created_by_user_id" ON "saving_movements" ("created_by_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saving_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saving_groups"`);
  }
}
