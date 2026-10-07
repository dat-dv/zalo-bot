# Kế hoạch Triển khai: Tối ưu UI Responsive Mobile & Hamburger Navigation Menu

Tái cấu trúc hệ thống điều hướng và giao diện Web Dashboard trên thiết bị di động (Mobile / Tablet), chuyển đổi thanh điều hướng Sidebar thành **Mobile Topbar Sticky kèm Hamburger Drawer Menu** trượt mượt mà, đồng thời tối ưu layout các khối dữ liệu (KPI metrics, Data panels, Data tables) để hiển thị hoàn hảo trên màn hình nhỏ.

---

## 1. Mục tiêu & Yêu cầu Kỹ thuật

- **Desktop (>= 961px)**: Giữ nguyên bố cục Enterprise Sidebar 210px cố định bên trái, chuyên nghiệp và data-dense.
- **Mobile & Tablet (<= 960px)**:
  - Ẩn sidebar mặc định.
  - Hiển thị **Mobile Top Bar** sticky trên cùng: Logo thương hiệu `[T] zalobot` + Nút **Hamburger Menu Button** (với biểu tượng ☰ / ✕ linh hoạt).
  - Khi người dùng bấm Hamburger Button:
    - Mở **Navigation Drawer** trượt từ bên trái với hiệu ứng transition mượt mà (`transform: translateX(0)`), chứa đầy đủ các phân mục (Tổng quan, Tài chính, Kế hoạch, Dữ liệu), nút chuyển Theme Sáng/Tối, và bộ chọn Ngôn ngữ (Vi/En).
    - Hiển thị **Backdrop Overlay** làm mờ nền phía sau.
    - Tự động đóng menu khi: bấm vào bất kỳ link điều hướng nào, bấm ra ngoài backdrop, bấm nút đóng (✕), hoặc nhấn phím `Escape`.
    - Khóa cuộn trang nền (`body overflow: hidden`) khi Drawer đang mở để tránh cuộn kép gây giật lag.
  - **Tối ưu toàn diện UI Mobile**:
    - Tinh chỉnh padding của container `.workspace` cho màn hình nhỏ (`10px 12px 20px`).
    - Tối ưu `WorkspaceHeader` và `header-status` để tự động xuống dòng mượt mà khi không đủ không gian.
    - Tối ưu `.metric-grid` hiển thị dạng lưới 2 cột cân đối trên màn hình điện thoại.
    - Tối ưu thanh tìm kiếm trong `DataPanel` mở rộng full-width trên thiết bị nhỏ (`<= 640px`).
    - Đảm bảo `DataTable` hỗ trợ cuộn ngang cảm ứng mượt mà (`-webkit-overflow-scrolling: touch`) không làm vỡ khung trang.
- **Tuân thủ quy chuẩn hệ thống**:
  - Zero Hardcoded User-Facing Text: Tất cả nhãn, aria-label, tooltip đều dùng key i18n (`packages/contracts`).
  - Zero Hardcoded Routes: Dùng hằng số `APP_ROUTES` và `API_ROUTES`.
  - Type-safe & Hỗ trợ đầy đủ Dark Mode / Light Mode đồng bộ.

---

## 2. Chi tiết các tệp sẽ thay đổi (Proposed Changes)

### Gói Shared Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung các translation key phục vụ điều hướng mobile và menu drawer (song ngữ `vi` và `en`):
  - `'nav.menu'`: `'Menu điều hướng'` / `'Navigation menu'`
  - `'nav.openMenu'`: `'Mở menu điều hướng'` / `'Open navigation menu'`
  - `'nav.closeMenu'`: `'Đóng menu'` / `'Close menu'`

---

### Giao diện Web Client (`apps/web`)

#### [MODIFY] [app-navigation.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx)

- Bổ sung state quản lý mở/đóng drawer: `isOpen: boolean`.
- Xử lý các sự kiện đóng tự động:
  - Khi chuyển route (`usePathname()` thay đổi).
  - Khi click vào bất kỳ item điều hướng nào.
  - Khi nhấn phím `Escape` (global keydown listener).
  - Tự động khôi phục / khóa cuộn trang (`document.body.style.overflow`).
- Render cấu trúc DOM:
  - **Mobile Topbar** (`.mobile-header`): chứa Brand Logo & Hamburger Button với `aria-expanded`, `aria-label`, icon 3 gạch / dấu X.
  - **Backdrop Overlay** (`.app-nav__backdrop`): phủ mờ nền khi menu mở.
  - **Navigation Drawer** (`aside.app-nav`): chứa Header drawer (Brand + Close button), danh sách link nhóm theo section, và Footer (Theme toggle + Language selector).

#### [MODIFY] [styles.css](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/styles.css)

- Thêm CSS classes cho Mobile Header, Hamburger Button, Backdrop, và Drawer:
  - `.mobile-header`: flexbox sticky top, border, background trắng/tối.
  - `.mobile-header__brand`, `.mobile-header__toggle`.
  - `.app-nav__backdrop`: fixed inset-0, background mờ mờ `rgba(0, 0, 0, 0.45)`, backdrop-filter blur.
  - `.app-nav`: trên mobile chuyển thành fixed drawer trượt từ trái sang (`transform: translateX(-100%)`, khi active `.is-open` thành `transform: translateX(0)`), z-index 60, bóng đổ mịn.
  - `.app-nav__close-btn`: nút đóng nhanh trên góc drawer.
- Cải tiến Media Queries (`@media (max-width: 960px)` & `@media (max-width: 640px)`):
  - Tối ưu spacing `.workspace`, `.workspace__header`, `.header-status`.
  - Grid metric 2 cột trên điện thoại (`repeat(auto-fit, minmax(135px, 1fr))`).
  - Search input trong data-panel hiển thị full-width hoặc co giãn linh hoạt.
  - DataTable overflow-x mượt mà trên mobile.
  - Hỗ trợ đầy đủ Dark Theme (`html[data-theme='dark']`) cho tất cả component mobile mới.

---

### Tài liệu & Kiến thức (`.agents/knowledge/` & `.agents/docs/`)

#### [MODIFY] [.agents/knowledge/modules/dashboard/dashboard.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/dashboard.md)

- Cập nhật mô tả kiến trúc giao diện responsive, mobile header bar và drawer menu behavior.

#### [MODIFY] [.agents/docs/modules/dashboard/dashboard.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/dashboard.md)

- Cập nhật hướng dẫn trải nghiệm người dùng trên thiết bị di động (Tiếng Việt).

---

## 3. Kế hoạch Kiểm thử & Xác thực (Verification Plan)

### Automated Verification

- Kiểm tra tính toàn vẹn hệ thống tài liệu và rules:
  ```bash
  npm run agent-system:validate
  ```
- Kiểm tra an toàn Type và Typescript compilation cho toàn monorepo:
  ```bash
  npm run typecheck
  ```
- Kiểm tra build thành công của Web App:
  ```bash
  npm run build
  ```

### Manual Verification

- Kiểm tra hiển thị trên Desktop (màn hình rộng > 960px): Sidebar hiển thị bình thường, không có mobile header / hamburger button thừa.
- Kiểm tra hiển thị trên Mobile / Tablet (màn hình <= 960px):
  - Mobile topbar hiển thị trên cùng với Brand và Hamburger button.
  - Bấm nút Hamburger: Drawer mở ra mượt mà, backdrop xuất hiện, body không bị cuộn lộn xộn.
  - Bấm link điều hướng: Chuyển trang thành công và menu tự động đóng lại.
  - Bấm phím `Escape` hoặc bấm vào backdrop: Menu đóng lại ngay lập tức.
  - Đổi theme Sáng/Tối và đổi ngôn ngữ Vi/En bên trong drawer: Hoạt động chính xác và tức thì.
  - Kiểm tra bảng dữ liệu (DataTable), KPI metrics và bộ lọc trên màn hình điện thoại (375px - 430px): Bố cục gọn gàng, không bị tràn màn hình ngang.
