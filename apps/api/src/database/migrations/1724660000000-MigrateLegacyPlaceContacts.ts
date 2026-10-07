import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateLegacyPlaceContacts1724660000000 implements MigrationInterface {
  name = 'MigrateLegacyPlaceContacts1724660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Đảm bảo unique index cho (user_id, normalized_name) trên bảng finance_places
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_finance_places_user_normalized_name" 
      ON "finance_places" ("user_id", "normalized_name")
    `);

    // 2. Sao chép địa điểm từ debt_contacts sang finance_places nếu chưa tồn tại (loại bỏ trùng lặp bằng DISTINCT ON)
    await queryRunner.query(`
      INSERT INTO "finance_places" ("id", "user_id", "name", "normalized_name", "created_at", "updated_at")
      SELECT DISTINCT ON (dc.user_id, dc.normalized_name)
        gen_random_uuid()::text,
        dc.user_id,
        dc.display_name,
        dc.normalized_name,
        dc.created_at,
        now()
      FROM "debt_contacts" dc
      WHERE (dc.descriptor = 'Địa điểm / Quán ăn' OR dc.descriptor ILIKE '%địa điểm%')
        AND dc.normalized_name IS NOT NULL AND dc.normalized_name != ''
        AND NOT EXISTS (
          SELECT 1 FROM "finance_places" fp 
          WHERE fp.user_id = dc.user_id AND fp.normalized_name = dc.normalized_name
        )
      ORDER BY dc.user_id, dc.normalized_name, dc.created_at ASC
    `);

    // 3. Cập nhật place_id cho các giao dịch trong finance_transactions đang trỏ contact_id tới contact địa điểm, gỡ contact_id
    await queryRunner.query(`
      UPDATE "finance_transactions" ft
      SET 
        "place_id" = COALESCE(ft.place_id, fp.id),
        "contact_id" = NULL
      FROM "debt_contacts" dc
      JOIN "finance_places" fp 
        ON fp.user_id = dc.user_id AND fp.normalized_name = dc.normalized_name
      WHERE ft.contact_id = dc.id
        AND (dc.descriptor = 'Địa điểm / Quán ăn' OR dc.descriptor ILIKE '%địa điểm%')
    `);

    // 4. Xử lý an toàn debts nếu có khoản nợ nào liên kết nhầm với contact địa điểm
    await queryRunner.query(`
      UPDATE "debts" d
      SET "contact_id" = NULL
      FROM "debt_contacts" dc
      WHERE d.contact_id = dc.id
        AND (dc.descriptor = 'Địa điểm / Quán ăn' OR dc.descriptor ILIKE '%địa điểm%')
    `);

    // 5. Xóa sạch các contact địa điểm khỏi debt_contacts
    await queryRunner.query(`
      DELETE FROM "debt_contacts"
      WHERE descriptor = 'Địa điểm / Quán ăn' OR descriptor ILIKE '%địa điểm%'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive down: giữ nguyên dữ liệu trong finance_places và finance_transactions
  }
}
