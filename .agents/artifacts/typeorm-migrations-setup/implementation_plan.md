# Kế Hoạch Thiết Lập Hệ Thống TypeORM Migration Chuẩn An Toàn

Hệ thống sẽ chuyển đổi từ cơ chế `TYPEORM_SYNCHRONIZE` (tiềm ẩn rủi ro mất dữ liệu trên production) sang **TypeORM Migrations chính thức** với cơ chế tự động thực thi khi ứng dụng khởi động (`migrationsRun: true`), bảo đảm an toàn dữ liệu 100% và không cần can thiệp thủ công khi deploy.

## User Review Required

> [!IMPORTANT]
>
> - **Cơ chế hoạt động**: Migration đầu tiên sẽ chứa toàn bộ schema hiện tại với cú pháp `IF NOT EXISTS` và `ADD COLUMN IF NOT EXISTS`. Khi chạy trên DB đang có dữ liệu, TypeORM sẽ chỉ bổ sung các bảng/cột còn thiếu và **không chạm vào bất kỳ dòng dữ liệu nào**.
> - **Tự động hóa hoàn toàn**: Khi deploy container API lên server, NestJS sẽ tự động chạy các migration mới nhất mà không cần vào terminal gõ lệnh tay.

## Proposed Changes

Group files by component:

---

### Backend Database Module (`apps/api`)

#### [NEW] [data-source.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/data-source.ts)

- Tạo TypeORM `DataSource` độc lập cho TypeORM CLI.
- Tự động nạp cấu hình từ `.env.local` và `.env`.
- Đăng ký toàn bộ Entities và Migrations.

#### [NEW] [1724650000000-InitSchema.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724650000000-InitSchema.ts)

- Migration khởi tạo toàn bộ 12 bảng thực thể và quan hệ:
  - `users`, `user_tokens`, `invites`, `reminders`
  - `finance_transactions`, `finance_places`, `user_categories`
  - `debts`, `debt_contacts`, `debt_payments`
  - `audit_logs`, `dashboard_exchange_tokens`
- Sử dụng cú pháp an toàn `CREATE TABLE IF NOT EXISTS` và `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` để tương thích hoàn hảo với database hiện tại.

#### [MODIFY] [database.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/database.module.ts)

- Tích hợp mảng `migrations` và bật `migrationsRun: true`.
- Khai báo `migrationsTableName: 'typeorm_migrations'`.
- Đặt mặc định `synchronize: false` để bảo vệ cơ sở dữ liệu.

#### [MODIFY] [package.json](file:///Users/datdoan/Documents/projects/zalobot/apps/api/package.json)

- Bổ sung các npm scripts cho việc quản lý migration:
  - `migration:run`: Chạy tất cả migration chưa áp dụng.
  - `migration:revert`: Rollback migration gần nhất.
  - `migration:generate`: Tự động so sánh Entity và sinh file migration mới.
  - `migration:create`: Tạo file migration trống.

---

### Documentation & Knowledge

#### [MODIFY] [.agents/knowledge/global/monorepo-architecture.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/monorepo-architecture.md)

- Cập nhật quy chuẩn database migration và vận hành sản xuất.

#### [MODIFY] [.agents/docs/global/monorepo-architecture.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/monorepo-architecture.md)

- Hướng dẫn nhà phát triển cách tạo và chạy migration khi có thay đổi Entity.

---

## Verification Plan

### Automated Tests & Quality Gates

- Chạy kiểm tra kiểu: `npm run typecheck`
- Chạy linter: `npm run lint`
- Chạy unit tests: `npm run test`

### Manual Verification

- Chạy thử migration trên môi trường kiểm thử để xác nhận schema được tạo đầy đủ và bảng `typeorm_migrations` ghi nhận đúng lịch sử.
