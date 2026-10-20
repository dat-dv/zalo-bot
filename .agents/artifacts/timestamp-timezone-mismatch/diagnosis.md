# Chẩn đoán: Lệch 7 tiếng giữa `occurred_at` và `created_at` (2026-10-20)

## Hiện tượng (production)
Giao dịch `957e415d-…`: `occurred_at = 2026-10-20 10:25:00`, `created_at = 2026-10-20 03:28:55` (raw trong DB). Người dùng tạo lúc 10:28 giờ VN.

## Đính chính
Kết luận trước đó "`occurred_at` lưu trễ 7 tiếng" là **sai**. Thử tái hiện cho thấy `occurred_at` đúng khi đọc qua app; cột bị lệch là **`created_at` / `updated_at`**.

## Nguyên nhân gốc
- Mọi cột thời gian là `timestamp without time zone` (không có `timestamptz` nào trong `src/database`).
- Process API chạy `TZ=Asia/Ho_Chi_Minh` (`apps/api/Dockerfile:28`, `docker-compose.yml:48`). Container Postgres dùng múi giờ mặc định UTC.
- Hai "đồng hồ" ghi vào cùng loại cột:
  - **Giá trị do Node ghi** (`occurredAt`, `remindAt`, `dueAt`, `expiresAt`…): `pg` gửi `2026-10-20T10:25:00.000+07:00`, Postgres bỏ offset → lưu **giờ VN**. Khi đọc, `pg` hiểu cột không-múi-giờ là giờ local (VN) → `03:25Z` ✅ đúng.
  - **Giá trị do Postgres tự sinh** (`@CreateDateColumn`/`@UpdateDateColumn` → `DEFAULT now()` / `CURRENT_TIMESTAMP`, session UTC): lưu **giờ UTC**. Khi đọc, `pg` lại hiểu là giờ VN → `2026-10-19T20:28:55Z` ❌ **sớm 7 tiếng**.

Tái hiện (`TZ=Asia/Ho_Chi_Minh node`, dùng `pg/lib/utils` + `pg-types` của repo):
```
instant (UTC)         : 2026-10-20T03:25:00.000Z
pg writes param as    : 2026-10-20T10:25:00.000+07:00
read back occurred_at : 2026-10-20T03:25:00.000Z   ← đúng
read back created_at  : 2026-10-19T20:28:55.812Z   ← sớm 7 tiếng
```

## Phạm vi ảnh hưởng
- 13 entity có `createdAt`/`updatedAt` do DB sinh: finance-transaction, finance-place, user-token, debt-contact, audit-log, reminder, dashboard-exchange-token, debt-payment, debt-payment-allocation, debt, user, user-category, zca-thread-config.
- Không có raw SQL `NOW()`/`CURRENT_TIMESTAMP`/`date_trunc` so sánh với cột do Node ghi → **không có lỗi lọc theo ngày/tháng** ở logic nghiệp vụ. `occurredAt` (dùng cho lọc kỳ, báo cáo, số dư) **đúng**.
- Ảnh hưởng thực tế:
  - Giờ hiển thị của `createdAt` sớm 7 tiếng: Hoạt động gần đây (audit log) trên trang chủ, ngày tạo user/nhóm, `createdAt` trong API giao dịch/thanh toán nợ.
  - Sắp xếp/tie-break theo `createdAt` vẫn đúng (mọi dòng lệch đều nhau), trừ chỗ trộn giá trị Node ghi tay với giá trị DB sinh (vd `thread-config.service.ts:620` gán `updatedAt` từ Node trong khi `@UpdateDateColumn` dùng DB).
  - Người đọc SQL trực tiếp (như lần chẩn đoán này) dễ hiểu nhầm.
- Mức độ: **thấp–trung bình** (chủ yếu hiển thị/kiểm toán, không sai số liệu tài chính).

## Đề xuất xử lý
**Phương án A (khuyến nghị, nhỏ):** đặt múi giờ session Postgres của kết nối API = `Asia/Ho_Chi_Minh` (TypeORM `extra: { options: '-c TimeZone=Asia/Ho_Chi_Minh' }` trong `database.module.ts` và `data-source.ts`, lấy từ `DEFAULT_TIMEZONE`). Từ đó `now()` sinh giờ VN, khớp quy ước hiện có của các cột Node ghi. Kèm **migration backfill** cộng 7 tiếng cho `created_at`/`updated_at` của các bản ghi cũ (chỉ các cột DB sinh; cần chốt mốc thời gian deploy để không cộng hai lần).
- Không đổi `TZ` của API sang UTC: sẽ làm lệch toàn bộ `occurred_at` đã lưu theo giờ VN.

**Phương án B (đúng chuẩn, lớn):** chuyển mọi cột sang `timestamptz` bằng migration `ALTER COLUMN … TYPE timestamptz USING col AT TIME ZONE '<múi giờ đã dùng khi ghi>'` (Asia/Ho_Chi_Minh cho cột Node ghi, UTC cho cột DB sinh). Loại bỏ hẳn phụ thuộc vào `TZ` của process. Cần plan riêng, test kỹ migration.

**Kiểm thử hồi quy:** test tích hợp ghi một entity rồi đọc lại, khẳng định `createdAt` ≈ `Date.now()` (±vài giây) và `occurredAt` giữ nguyên instant.
