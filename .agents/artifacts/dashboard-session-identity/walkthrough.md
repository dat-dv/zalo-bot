# Walkthrough: Hiển thị tài khoản đang đăng nhập & ẩn menu admin

Plan đã được duyệt nguyên văn.

## Thay đổi

- **Contracts**: thêm `API_ROUTES.sessionMe = '/api/me'`, kiểu `IDashboardSessionUser`, chuỗi `session.*` (vi/en).
- **API**:
  - `UsersService.getSessionProfile(id)`: tên lấy theo thứ tự danh bạ ZCA (cache) → `firstName` → `null`; avatar; `isAdmin`; `isDashboardOwner`.
  - `ReportsController.me` (`GET /api/me`, xác thực Bearer).
- **Web**:
  - `modules/auth/api/session-user-api.ts`, `session-user-query.ts`.
  - `presentation/components/session-user-card.tsx`.
  - `shared/ui/nav-visibility.ts` (`visibleNavSections`).
  - `app-navigation.tsx`: thêm `adminOnly` cho `zca` và `googleStorage`; đặt thẻ ở footer thanh bên và đầu sheet "Thêm".
- **Tài liệu**: `knowledge|docs/global/dashboard-session.md`, `knowledge|docs/modules/auth/README.md`, `knowledge/project-overview.md`.

## Khác với plan

- `dashboard-owner` đã đổi tên (khác tên mặc định "Chủ hệ thống") thì hiện tên đã đổi. Còn tên mặc định thì vẫn hiện nhãn i18n "Chủ hệ thống (mã đăng nhập)" như plan.

## Kiểm tra

- `npm run typecheck`, `npm run lint`: pass. Có rebuild `@zalobot/contracts` vì session `zca-status-403` chạy song song đã thêm khoá `zca.forbidden.*` vào source contracts.
- `npm run test`: api 566/566, web 100/100. Test mới:
  - `users-session-profile.spec.ts`: 4 test.
  - `reports-me.spec.ts`: 2 test.
  - `nav-visibility.spec.ts`: 3 test.
- `npm run build --workspace @zalobot/web`: pass.
- `docs-drift-check`: PASS.
- **Chưa kiểm tra trên trình duyệt**: không có dev server zalobot chạy được trên máy, và production chưa deploy bản này.
