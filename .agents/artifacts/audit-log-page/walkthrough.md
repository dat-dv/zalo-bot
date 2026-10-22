# Walkthrough: Nhật ký hoạt động + ghi đúng người thực hiện

- Ngày: 2026-10-23
- Kế hoạch: [implementation_plan.md](implementation_plan.md), được duyệt với mặc định Q1–Q3: ghi người yêu cầu (không ghi người duyệt), đường dẫn `/activity`, ẩn 4 bảng kỹ thuật.
- Version: `v1.0.175`. `v1.0.174` đã được nhánh `feat/reminder-repeat-and-nag` dùng làm tag local nên bỏ qua.

## Đã làm

1. **Contracts**:
   - `API_ROUTES.auditLogs/auditLog`, `APP_ROUTES.activity/activityFor`.
   - `AUDIT_ACTOR_SOURCES`, `AUDIT_SOURCE_FILTERS`, `AUDIT_ACTIONS`, `AUDIT_TABLES` (17 bảng, nhóm, cờ kỹ thuật), các type guard.
   - DTO danh sách/chi tiết, i18n `audit.*` (vi + en).
2. **Ghi người thực hiện**:
   - `audit/audit-context.ts` (AsyncLocalStorage) + `AuditContextMiddleware`.
   - `getDashboardUserId` gắn người dùng sau khi xác thực token; `ReportsController` dùng chung hàm này.
   - Subscriber lấy người từ ngữ cảnh và bỏ hẳn cách lấy từ `userId`/`createdByUserId` của dòng.
3. **Bọc ngữ cảnh**:
   - `ZcaService.dispatchMessage/dispatchReaction`: ghi theo người gửi và kênh.
   - `processConfirm` → `executeConfirmed`: ghi theo người yêu cầu.
   - Hai processor BullMQ và import Google Calendar chạy với nguồn `system`.
4. **DB**:
   - Migration `1724950000000-AddAuditLogActorSource` thêm `actor_source`, `channel_id` và index `created_at DESC`.
   - Cập nhật entity; dòng nhật ký của gộp tài khoản ghi `actorSource: 'dashboard'`.
5. **API admin**:
   - `GET /api/audit-logs` và `GET /api/audit-logs/:id`, đặt trong `AuditAdminModule` để tránh vòng import.
   - `parseAuditLogListQuery`, `computeChangedFields`.
6. **Web**:
   - Module `audit` (api, query, model, components, view) và trang `/activity`.
   - Mục menu chỉ admin, tiêu đề header.
   - Link "Xem lịch sử thay đổi" trong chi tiết giao dịch và "Xem tất cả" ở khối Hoạt động trang chủ (chỉ admin).
7. **Tài liệu**:
   - Module mới `knowledge/docs modules/audit`.
   - Cập nhật global `backend-runtime-services`, `finance-domain`, `backend-crud-api`, `dashboard-session`, `project-overview`, module `dashboard` và `users`, các index, `CONTEXT.md`.
   - Sửa luôn mô tả sai cũ "bulk write không được audit": thực tế TypeORM vẫn gọi subscriber, chỉ thiếu dữ liệu.

## Kiểm tra đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` (contracts, api, web) | Sạch |
| `npm run lint` (contracts, api, web) | Sạch |
| `npm run test --workspace @zalobot/api` | 647/647 pass |
| `npm run test --workspace @zalobot/web` | 128/128 pass |
| `npm run build --workspace @zalobot/web` | Thành công, có route `/activity` |
| `node .claude/hooks/docs-drift-check.mjs --all` | PASS (0 lỗi) |

## Chưa kiểm chứng

- **Chưa chạy migration trên DB thật**: máy không có Postgres của zalobot đang chạy. Container Postgres local thuộc dự án khác nên không đụng vào. Migration chỉ dùng `ADD COLUMN IF NOT EXISTS` và `CREATE INDEX IF NOT EXISTS`, và tự chạy khi API khởi động (`migrationsRun: true`).
- **Chưa xem giao diện trên trình duyệt**: không có API + DB local để trang có dữ liệu. Cần kiểm tra sau khi deploy:
  - Sửa giao dịch của người khác → nhật ký ghi đúng người sửa.
  - Bộ lọc và URL hoạt động đúng.
  - Hộp thoại trước/sau hiển thị đúng.
  - Giao diện điện thoại.
  - Tài khoản không phải admin thấy thông báo chặn.
