import { MigrationInterface, QueryRunner } from 'typeorm';

/** Finance tables that used to be partitioned per user through `user_id`. */
const FINANCE_TABLES = [
  'finance_transactions',
  'finance_places',
  'debt_contacts',
  'debts',
  'debt_payments',
  'debt_payment_allocations',
  'user_categories',
] as const;

interface CountRow {
  user_id: string;
  count: string | number;
}

/** `QueryRunner.query` is untyped; SELECTs in this migration always return an array of rows. */
async function selectRows<T>(queryRunner: QueryRunner, sql: string): Promise<T[]> {
  const rows: unknown = await queryRunner.query(sql);
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/**
 * The system keeps exactly one finance store: every user sees and edits all finance data, so
 * `user_id` is dropped from the finance tables. Rows that were split across per-user ledgers are
 * folded together first (same place name, same contact name+alias, same category), and each
 * transaction keeps its author in `created_by_user_id`.
 *
 * Plain SQL on purpose: entities no longer have `userId`, so they cannot describe the old schema.
 */
export class RemoveFinanceUserScope1724790000000 implements MigrationInterface {
  name = 'RemoveFinanceUserScope1724790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('finance_transactions', 'user_id'))) return;

    const ledgers: Record<string, Record<string, number>> = {};
    for (const table of FINANCE_TABLES) {
      const rows = await selectRows<CountRow>(
        queryRunner,
        `SELECT "user_id", COUNT(*) AS "count" FROM "${table}" GROUP BY "user_id"`,
      );
      ledgers[table] = Object.fromEntries(rows.map((r) => [r.user_id, Number(r.count)]));
    }

    // Keep "Người tạo" for rows written before creator tracking existed.
    await queryRunner.query(`
      UPDATE "finance_transactions" SET "created_by_user_id" = "user_id"
      WHERE "created_by_user_id" IS NULL
    `);

    // Places: one row per normalized name, the earliest wins.
    await queryRunner.query(`
      CREATE TEMP TABLE "place_merge_map" ON COMMIT DROP AS
      SELECT "id", "keep_id" FROM (
        SELECT "id", FIRST_VALUE("id") OVER (
          PARTITION BY "normalized_name" ORDER BY "created_at", "id"
        ) AS "keep_id"
        FROM "finance_places"
      ) ranked WHERE "id" <> "keep_id"
    `);
    await queryRunner.query(`
      UPDATE "finance_transactions" t SET "place_id" = m."keep_id"
      FROM "place_merge_map" m WHERE t."place_id" = m."id"
    `);
    await queryRunner.query(
      `DELETE FROM "finance_places" WHERE "id" IN (SELECT "id" FROM "place_merge_map")`,
    );

    // Contacts: one row per normalized name + alias, the earliest wins and inherits what it lacks.
    await queryRunner.query(`
      CREATE TEMP TABLE "contact_merge_map" ON COMMIT DROP AS
      SELECT "id", "keep_id" FROM (
        SELECT "id", FIRST_VALUE("id") OVER (
          PARTITION BY "normalized_name", COALESCE("normalized_alias", '')
          ORDER BY "created_at", "id"
        ) AS "keep_id"
        FROM "debt_contacts"
      ) ranked WHERE "id" <> "keep_id"
    `);
    await queryRunner.query(`
      UPDATE "debt_contacts" k SET
        "phone_number" = COALESCE(NULLIF(k."phone_number", ''), d."phone_number"),
        "avatar_url" = COALESCE(NULLIF(k."avatar_url", ''), d."avatar_url"),
        "linked_user_id" = COALESCE(k."linked_user_id", d."linked_user_id")
      FROM (
        SELECT m."keep_id",
          MAX(NULLIF(c."phone_number", '')) AS "phone_number",
          MAX(NULLIF(c."avatar_url", '')) AS "avatar_url",
          MIN(c."linked_user_id") AS "linked_user_id"
        FROM "contact_merge_map" m JOIN "debt_contacts" c ON c."id" = m."id"
        GROUP BY m."keep_id"
      ) d
      WHERE k."id" = d."keep_id"
    `);
    await queryRunner.query(`
      UPDATE "debts" t SET "contact_id" = m."keep_id"
      FROM "contact_merge_map" m WHERE t."contact_id" = m."id"
    `);
    await queryRunner.query(`
      UPDATE "finance_transactions" t SET "contact_id" = m."keep_id"
      FROM "contact_merge_map" m WHERE t."contact_id" = m."id"
    `);
    await queryRunner.query(
      `DELETE FROM "debt_contacts" WHERE "id" IN (SELECT "id" FROM "contact_merge_map")`,
    );

    // A user links to at most one contact in the (now single) directory: keep the earliest link.
    const unlinked = await selectRows<{ count: string | number }>(
      queryRunner,
      `
      WITH ranked AS (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "linked_user_id" ORDER BY "created_at", "id"
        ) AS "rn"
        FROM "debt_contacts" WHERE "linked_user_id" IS NOT NULL
      )
      SELECT COUNT(*) AS "count" FROM ranked WHERE "rn" > 1
    `,
    );
    await queryRunner.query(`
      UPDATE "debt_contacts" c SET "linked_user_id" = NULL
      FROM (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "linked_user_id" ORDER BY "created_at", "id"
        ) AS "rn"
        FROM "debt_contacts" WHERE "linked_user_id" IS NOT NULL
      ) r
      WHERE c."id" = r."id" AND r."rn" > 1
    `);

    // Categories: transactions store the category name, so duplicates are simply removed.
    await queryRunner.query(`
      CREATE TEMP TABLE "category_merge_map" ON COMMIT DROP AS
      SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "type", LOWER(TRIM("name")) ORDER BY "created_at", "id"
        ) AS "rn"
        FROM "user_categories"
      ) ranked WHERE "rn" > 1
    `);
    await queryRunner.query(
      `DELETE FROM "user_categories" WHERE "id" IN (SELECT "id" FROM "category_merge_map")`,
    );

    const count = async (table: string): Promise<number> => {
      const rows = await selectRows<{ count: string | number }>(
        queryRunner,
        `SELECT COUNT(*) AS "count" FROM "${table}"`,
      );
      return Number(rows[0]?.count ?? 0);
    };
    const merged = {
      places: await count('place_merge_map'),
      contacts: await count('contact_merge_map'),
      categories: await count('category_merge_map'),
      unlinkedContacts: Number(unlinked[0]?.count ?? 0),
    };
    await queryRunner.query(
      `INSERT INTO "audit_logs" ("table_name", "action", "before_data", "after_data")
       VALUES ('finance_transactions', 'update', $1, $2)`,
      [
        JSON.stringify({ ledgers }),
        JSON.stringify({ operation: 'remove-finance-user-scope', merged }),
      ],
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_finance_places_user_normalized_name"`);
    for (const table of FINANCE_TABLES) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_user_id"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "user_id"`);
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_finance_places_normalized_name"
      ON "finance_places" ("normalized_name")
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_single_ledger_owner"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_ledger_owner"`);
  }

  /**
   * Restores the columns only. Folded duplicates and the original per-user split cannot be
   * rebuilt; restore the pre-migration database backup to get them back.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_ledger_owner" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_single_ledger_owner"
      ON "users" ("is_ledger_owner") WHERE "is_ledger_owner" = true
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_finance_places_normalized_name"`);
    for (const table of FINANCE_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "user_id" character varying`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_user_id" ON "${table}" ("user_id")`,
      );
    }
  }
}
