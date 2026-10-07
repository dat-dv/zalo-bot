# Kế hoạch tái cấu trúc Header dùng chung (Common Header Refactor)

## Mô tả bài toán

Hiện tại `WorkspaceHeader` đang được import và render riêng lẻ ở 9 màn hình nghiệp vụ khác nhau (`dashboard-home-screen.tsx`, `transactions-screen.tsx`, `debts-screen.tsx`, `expenses-screen.tsx`, `analytics-screen.tsx`, `calendar-screen.tsx`, `tasks-screen.tsx`, `reminders-screen.tsx`, `contacts-screen.tsx`, `settings-screen.tsx`). Điều này gây phân tán mã nguồn, lặp lại logic và chưa phân tách rõ ràng giữa trạng thái đã đăng nhập (Authenticated) và chưa đăng nhập (Public/Unauthenticated).

Kế hoạch này sẽ:

1. Chuyển `WorkspaceHeader` thành một **Header Dùng Chung (Common Layout Header)** đặt trực tiếp tại `apps/web/app/(private)/layout.tsx`.
2. Tự động nhận diện `title` và `subtitle` theo route hiện tại (`usePathname()`).
3. Xử lý 2 trạng thái rõ ràng:
   - **Đã đăng nhập (`isLoggedIn = true`)**: Hiển thị Tiêu đề + Phụ đề trang, nút Ẩn/Hiện tiền (`useMoneyVisibility`), nút Làm mới (`queryClient.invalidateQueries()`), và nút Đăng xuất.
   - **Chưa đăng nhập / Hết phiên (`isLoggedIn = false`)**: Hiển thị thương hiệu zalobot, nút mở bot zalo và tùy chọn Theme/Ngôn ngữ (ẩn các nút thao tác nghiệp vụ riêng tư).
4. Loại bỏ các lệnh gọi `<WorkspaceHeader ...>` cục bộ ở toàn bộ 9 màn hình nghiệp vụ.
5. Cập nhật đầy đủ tài liệu canonical knowledge (tiếng Anh) và developer documentation (tiếng Việt).

## Đánh giá rủi ro

- **Mức độ rủi ro**: TRUNG BÌNH (MEDIUM RISK) - Tái cấu trúc layout và các màn hình web app, cần kiểm tra toàn diện routing, query caching và trạng thái auth.

---

## Thay đổi đề xuất

### 1. Shared UI Component & Layout

#### [MODIFY] [workspace-header.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/workspace-header.tsx)

- Cho phép `title` và `subtitle` là optional (nếu không truyền, tự động map theo `usePathname()` sang translation keys tương ứng của từng trang).
- Tự động xử lý `handleRefresh` qua `queryClient.invalidateQueries()` nếu không truyền prop `onRefresh` tùy biến.
- Nhận diện trạng thái đăng nhập qua `getAccessToken()` và hiển thị giao diện tương ứng (Authenticated vs Unauthenticated).

#### [MODIFY] [layout.tsx (private)](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/%28private%29/layout.tsx)

- Đặt `<WorkspaceHeader />` ngay trên đầu thẻ `<section>` nội dung để tất cả các trang private tự động thừa hưởng Header dùng chung.

---

### 2. Dọn dẹp WorkspaceHeader cục bộ tại các module screen

#### [MODIFY] [dashboard-home-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [analytics-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [calendar-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [tasks-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [reminders-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/reminders-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [contacts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/contacts/view/contacts-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [debts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [expenses-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

#### [MODIFY] [settings-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/settings/view/settings-screen.tsx)

- Xóa `<WorkspaceHeader ... />` và import không dùng.

---

### 3. Đồng bộ tài liệu hệ thống (Canonical Knowledge & Developer Docs)

Cập nhật tài liệu phản ánh cấu trúc Common Header tại layout và cơ chế nhận diện 2 trạng thái auth:

- [web-ui-direction.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/web-ui-direction.md)
- [dashboard/README.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)
- [contacts/README.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/contacts/README.md)
- [debts/README.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md)
- [expenses/README.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/expenses/README.md)
- [settings/README.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/settings/README.md)
- [auth/README.md (EN & VI)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/auth/README.md)

---

## Kế hoạch kiểm thử & xác minh

### Automated Validation

1. Chạy xác thực agent system:
   ```bash
   npm run agent-system:validate -- --check-changes --check-i18n
   ```
2. Chạy typecheck và lint toàn bộ workspaces:
   ```bash
   npm run typecheck
   npm run lint
   ```
3. Chạy build production web app:
   ```bash
   npm run build:web
   ```

### Manual Verification

- Điều hướng qua lại giữa tất cả các trang (`/`, `/transactions`, `/debts`, `/expenses`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/settings`) để xác nhận tiêu đề tự động cập nhật đúng và nút Làm mới / Ẩn tiền / Đăng xuất hoạt động chính xác.
- Kiểm tra trạng thái đã đăng xuất (`?status=logged_out`) và chưa có token.
