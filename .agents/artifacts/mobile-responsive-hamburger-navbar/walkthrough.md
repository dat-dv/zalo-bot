# Walkthrough: Tối ưu UI Responsive Mobile & Hamburger Navigation Menu

Đã hoàn thành việc tái cấu trúc hệ thống điều hướng và nâng cấp trải nghiệm giao diện Web Dashboard trên các thiết bị di động (Mobile / Tablet).

---

## 1. Những thay đổi đã thực hiện

### 1.1. Shared Contracts (`packages/contracts`)

- [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts): Bổ sung các translation key song ngữ `vi` và `en` phục vụ điều hướng mobile:
  - `'nav.menu'`: `'Menu điều hướng'` / `'Navigation menu'`
  - `'nav.openMenu'`: `'Mở menu điều hướng'` / `'Open navigation menu'`
  - `'nav.closeMenu'`: `'Đóng menu điều hướng'` / `'Close navigation menu'`

### 1.2. App Navigation Component (`apps/web`)

- [app-navigation.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx):
  - Tích hợp **Mobile Header Bar** (`.mobile-header`) sticky trên cùng với Brand Logo `[T] zalobot` và nút **Hamburger Toggle Button** (icon ☰ / ✕ linh hoạt, có `aria-expanded` và `aria-label`).
  - Xây dựng **Backdrop Overlay** (`.app-nav__backdrop`) phủ mờ nền khi menu drawer mở.
  - Chuyển đổi `<aside className="app-nav">` thành **Navigation Drawer** trượt từ bên trái với hiệu ứng animation mượt mà.
  - Tự động đóng menu khi: người dùng bấm vào bất kỳ link điều hướng nào, bấm ra ngoài backdrop, bấm nút đóng (✕), hoặc bấm phím `Escape`.
  - Tự động khóa cuộn trang (`body overflow: hidden`) khi drawer đang mở nhằm ngăn chặn hiện tượng cuộn lồng nhau.

### 1.3. Responsive Styling & Dark Mode (`apps/web`)

- [styles.css](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/styles.css):
  - Ẩn hoàn toàn Mobile Header, Backdrop và Close Button trên Desktop (`min-width: 961px`), giữ nguyên giao diện Enterprise Sidebar cố định 210px bên trái.
  - Trên Mobile (`max-width: 960px`):
    - Kích hoạt Mobile Header sticky với z-index 40.
    - Thiết lập Drawer trượt (`transform: translateX(-100%)` -> `transform: translateX(0)` khi active `.is-open`), z-index 60, bóng đổ mịn.
    - Tối ưu khoảng đệm `.workspace` (`padding: 10px 12px 20px`), linh hoạt cho `WorkspaceHeader` và `header-status`.
    - Lưới KPI Metrics co giãn tối ưu (`repeat(auto-fit, minmax(135px, 1fr))`).
  - Trên màn hình nhỏ (`max-width: 640px`):
    - Lưới KPI Metrics 2 cột đều đặn (`repeat(2, 1fr)`).
    - Thanh tìm kiếm trong `DataPanel` tự động co giãn full-width.
    - Cuộn ngang bảng dữ liệu `DataTable` mượt mà với `-webkit-overflow-scrolling: touch`.
  - Hỗ trợ đầy đủ Dark Theme (`html[data-theme='dark']`) cho toàn bộ các thành phần Mobile Header, Hamburger Button, Drawer, và Backdrop.

### 1.4. Cập nhật Tài liệu & Kiến thức

- [.agents/knowledge/global/web-ui-direction.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/web-ui-direction.md) & [.agents/knowledge/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)
- [.agents/docs/global/web-ui-direction.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/web-ui-direction.md) & [.agents/docs/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

---

## 2. Kết quả Xác thực (Verification Results)

| Kiểm tra                       | Lệnh thực thi                   | Kết quả                                                        |
| :----------------------------- | :------------------------------ | :------------------------------------------------------------- |
| **Agent System Integrity**     | `npm run agent-system:validate` | ✅ Pass (82 artifacts, 146 dependencies, 0 cyclic groups)      |
| **Monorepo Typecheck**         | `npm run typecheck`             | ✅ Pass (0 errors across api, web, contracts)                  |
| **Full Build & Static Export** | `npm run build`                 | ✅ Pass (Next.js 16.3.2 export 12/12 static routes thành công) |
