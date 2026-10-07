# Walkthrough: Thiết Lập Hệ Thống TypeORM Migration Chuẩn An Toàn

Đã hoàn thành việc thiết lập hệ thống **TypeORM Migrations tự động** cho backend zalobot, đảm bảo dữ liệu sản xuất được bảo vệ an toàn 100% (Zero Data Loss) và database tự động cập nhật mỗi khi khởi động container API.

## Thay Đổi Đã Thực Hiện

### 1. Backend TypeORM Migrations (`apps/api`)

- [NEW] [1724650000000-InitSchema.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724650000000-InitSchema.ts): Migration khởi tạo an toàn với 100% cú pháp `IF NOT EXISTS` và `ADD COLUMN IF NOT EXISTS` cho 12 bảng thực thể.
- [NEW] [data-source.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/data-source.ts): File cấu hình DataSource độc lập phục vụ CLI TypeORM.
- [MODIFY] [database.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/database.module.ts):
  - Bật `migrationsRun: true` để tự động chạy migration khi khởi động app.
  - Cấu hình bảng lưu lịch sử: `migrationsTableName: 'typeorm_migrations'`.
  - Mặc định `synchronize: false` để bảo vệ an toàn dữ liệu production.
- [MODIFY] [package.json](file:///Users/datdoan/Documents/projects/zalobot/apps/api/package.json):
  - Thêm `typeorm`, `migration:run`, `migration:revert`, `migration:generate`, `migration:create`.

### 2. Đồng Bộ Tri Thức & Tài Liệu Vận Hành

- [MODIFY] [.agents/knowledge/global/monorepo-architecture.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/monorepo-architecture.md): Cập nhật quy chuẩn database migrations (English).
- [MODIFY] [.agents/docs/global/monorepo-architecture.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/monorepo-architecture.md): Bổ sung hướng dẫn vận hành TypeORM migration cho developer (Vietnamese).

---

## Kết Quả Kiểm Tra & Xác Minh

- `npm run typecheck`: ✅ Thành công 100% across all workspaces (`@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
- `npm run lint`: ✅ Thành công 100% (0 errors, 0 warnings).
- `npm test --workspace @zalobot/api`: ✅ 54/54 tests passed.
- `npm run build:api`: ✅ NestJS build thành công.
- `npm run agent-system:validate`: ✅ Hệ thống tài liệu & tri thức hợp lệ.
