# Walkthrough: Sửa 5 điểm của trang Nhật ký hoạt động

- Ngày: 2026-10-23
- Kế hoạch: [implementation_plan.md](implementation_plan.md), được duyệt với Q1 = làm cả 3B (lưu tên người gửi), Q2 = bộ lọc trên điện thoại áp dụng ngay.
- Version: `v1.0.177`.

## Đã làm

1. **Nút "Xem" bị đẩy ra ngoài (desktop)**: `audit-table.tsx`
   - Ô **Dữ liệu** thành nút mở chi tiết: hành động có màu, loại dữ liệu chữ xanh, gạch chân khi hover.
   - Thu hẹp cột: thời điểm 130, người 180, dữ liệu 200, trường đổi 160.
   - Giữ cột "Xem" vì sheet trên điện thoại dùng cột này làm nút ở chân.
2. **Hết phiên không hiện form đăng nhập**:
   - `isUnauthorizedError`; không retry 401/403.
   - `ActivityScreen`: 401 → `SessionStateScreen reason="expired"`.
3. **Tên "Chưa rõ tên"**:
   - **3A**: `UsersService.resolveZaloNames` (danh bạ ZCA, cache). `AuditController` truyền vào `AuditService.list/get` dưới dạng `AuditNameResolver`.
   - **3B**: migration `1724970000000-AddAuditLogActorName`, cột `actor_name`.
     - `zaloAuditContext(sender, chat, dName)`.
     - Subscriber ghi `actorName`.
     - `processConfirm` chỉ giữ tên khi người duyệt chính là người yêu cầu.
   - Thứ tự tên: danh bạ ZCA → `actor_name` → `first_name`. Áp dụng cho dòng, chi tiết và danh sách người trong bộ lọc (`GROUP BY actor_id` + `MAX(actor_name)`).
4. **Trang chủ**:
   - `listRecent` loại `AUDIT_TECHNICAL_TABLES`.
   - `IDashboardData.activity[].action: AuditAction`.
   - Khối Hoạt động dùng `describeAuditChange` ("Thêm · Lời nhắc") và màu `AUDIT_ACTION_TONE`; tìm kiếm theo nhãn đã dịch.
5. **Bộ lọc trên điện thoại**:
   - `AuditFilters` tách `AuditFilterFields` (`row` | `stack`).
   - Điện thoại: chip **Bộ lọc · n** + chip mã bản ghi + "Xoá bộ lọc". Chip mở sheet "Lọc nhật ký": ô xếp dọc có nhãn, 40px, áp dụng ngay, nút **Xong**.
   - `countActiveAuditFilters` + spec.
   - i18n `audit.filter.open/openCount/sheetTitle/done` (vi + en).
6. **Tài liệu**:
   - `knowledge` + `docs` của `modules/audit`, `modules/dashboard`, `global/backend-runtime-services`.

## Kiểm tra đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` (contracts, api, web) | Sạch |
| `npm run lint` (contracts, api, web) | Sạch |
| `npm run test --workspace @zalobot/api` | 684/684 pass |
| `npm run test --workspace @zalobot/web` | 138/138 pass |
| `npm run build --workspace @zalobot/web` | Thành công, có route `/activity` |
| `node .claude/hooks/docs-drift-check.mjs --all` | PASS (0 lỗi) |

## Chưa kiểm chứng

- **Chưa chạy migration trên DB thật**: migration chỉ có `ADD COLUMN IF NOT EXISTS`, tự chạy khi API khởi động.
- **Chưa xem giao diện trên trình duyệt**: máy không có API + DB của zalobot. Sau khi deploy cần xem trên production:
  - Ở 1280px, bấm ô Dữ liệu mở được chi tiết.
  - Chip Bộ lọc và sheet trên điện thoại.
  - Tên người thực hiện đã hiện.
  - Nhãn tiếng Việt ở trang chủ.
- **Dòng nhật ký cũ** không có `actor_name`. Người không có trong danh bạ và không có `first_name` vẫn hiện "Chưa rõ tên" ở các dòng này.
