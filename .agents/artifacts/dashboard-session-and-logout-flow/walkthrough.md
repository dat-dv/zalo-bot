# Walkthrough: Nâng cấp Màn hình Phiên làm việc & Chuẩn hóa Luồng Đăng xuất

Đã hoàn thành nâng cấp giao diện xử lý phiên làm việc khi hết hạn hoặc sau khi đăng xuất, khắc phục triệt để tình trạng lặp lỗi khi bấm "Thử lại", bổ sung nút mở trực tiếp zalo Bot và nút xóa phiên sạch sẽ.

---

## 1. Tóm tắt các thay đổi đã thực hiện

### 1.1. Bổ sung từ điển đa ngôn ngữ i18n (`packages/contracts`)

- File sửa: [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)
- Bổ sung translation keys cho cả `vi` và `en`:
  - `auth.loggedOut.title`, `auth.loggedOut.desc`
  - `auth.sessionExpired.title`, `auth.sessionExpired.desc`
  - `auth.openzaloBot`
  - `auth.clearSessionAndRetry`
  - `auth.backToAbout`
  - `auth.closeMiniApp`
- Build package contracts để cập nhật type definitions (`dist/index.d.ts`).

### 1.2. Tạo Component `SessionStateScreen` (`apps/web`)

- File tạo mới: [`apps/web/src/modules/auth/view/session-state-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/auth/view/session-state-screen.tsx)
- Hỗ trợ 2 chế độ hiển thị rõ ràng:
  1. `reason === 'logged_out'`: _"Đã đăng xuất thành công - Phiên làm việc của bạn đã kết thúc an toàn."_
  2. `reason === 'expired'`: _"Phiên làm việc đã hết hạn - Phiên truy cập đã hết hạn hoặc không tìm thấy thông tin đăng nhập."_
- Cung cấp các nút tương tác:
  - **Nút "Mở zalo Bot"**: Điều hướng tới bot zalo (`NEXT_PUBLIC_zalo_BOT_URL` hoặc `@NEXT_PUBLIC_zalo_BOT_USERNAME`).
  - **Nút "Đóng cửa sổ"**: Tự động hiển thị khi mở trong zalo Mini App (`window.zalo.WebApp.close()`).
  - **Nút "Xóa phiên & Thử lại"**: Xóa `localStorage`, xóa `sessionStorage`, reset toàn bộ cache `QueryClient` và reload trang.
  - **Liên kết "Xem trang giới thiệu"**: Dẫn về [`APP_ROUTES.about`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/about/page.tsx).

### 1.3. Cải thiện luồng Đăng xuất & Tích hợp vào các trang

- **[`workspace-header.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/workspace-header.tsx)**: Cập nhật hàm `handleLogout` chuyển hướng đến `${APP_ROUTES.home}?status=logged_out` sau khi xóa token và gọi API logout.
- **[`dashboard-home-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)**: Kiểm tra `status === 'logged_out'` để render `SessionStateScreen` ở trạng thái đăng xuất thành công; khi có lỗi dữ liệu hoặc 401 render `SessionStateScreen` ở trạng thái hết hạn.
- **[`analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)**: Tích hợp `SessionStateScreen` khi gặp lỗi 401 / isError.
- **[`dashboard-query.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/api/dashboard-query.ts)**: Hỗ trợ option `{ enabled?: boolean }` để tránh gọi API thừa khi người dùng đã ở trạng thái đăng xuất.

### 1.4. Đồng bộ Biến môi trường & Canonical Documentation

- **[`.env.example`](file:///Users/datdoan/Documents/projects/zalobot/.env.example)**: Bổ sung cấu hình mẫu cho `NEXT_PUBLIC_zalo_BOT_URL` và `NEXT_PUBLIC_zalo_BOT_USERNAME`.
- **[`.agents/knowledge/modules/auth/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/auth/README.md)** (English): Cập nhật kiến trúc `SessionStateScreen` và luồng logout.
- **[`.agents/docs/modules/auth/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/auth/README.md)** (Vietnamese): Cập nhật hướng dẫn phát triển về màn hình phiên làm việc.

---

## 2. Kết quả kiểm thử & Quality Gates

| Kiểm tra                    | Lệnh thực thi                            | Kết quả                         |
| :-------------------------- | :--------------------------------------- | :------------------------------ |
| **Agent System Validation** | `npm run agent-system:validate`          | ✅ Passed (0 error)             |
| **Workspace Typecheck**     | `npm run typecheck`                      | ✅ Passed (0 error)             |
| **Workspace Linter**        | `npm run lint`                           | ✅ Passed (0 error)             |
| **API Unit Tests**          | `npm run test --workspace=@zalobot/api`  | ✅ Passed (54/54 tests)         |
| **Next.js Static Build**    | `npm run build --workspace=@zalobot/web` | ✅ Passed (18/18 static routes) |
