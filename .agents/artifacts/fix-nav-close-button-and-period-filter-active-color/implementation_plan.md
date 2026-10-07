# Kế hoạch khắc phục lỗi nút Đóng menu và màu active PeriodFilterToolbar

## 1. Bối cảnh & Nguyên nhân gốc rễ (Root Cause Analysis)

### Vấn đề 1: Nút "Đóng menu điều hướng" vẫn hiển thị trên Desktop (> 960px)

- **Vị trí**: [`apps/web/src/shared/ui/app-navigation.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx) (dòng 188–196).
- **Nguyên nhân**:
  - Khai báo CSS toàn cục trong `apps/web/src/styles.css` (dòng 120–141) có quy tắc `button, .button { display: inline-flex; }` không nằm trong CSS `@layer`.
  - Theo chuẩn CSS Cascade Layers, các quy tắc unlayered luôn có độ ưu tiên cao hơn quy tắc bên trong `@layer utilities` của Tailwind (`.hidden { display: none; }`).
  - Do đó, class `hidden` bị `button { display: inline-flex; }` ghi đè, khiến nút "Đóng menu điều hướng" bị hiển thị trên màn hình Desktop thay vì chỉ hiển thị trong Drawer ở màn hình Mobile (`<= 960px`).

### Vấn đề 2: Nút active trong `PeriodFilterToolbar` ở Light Mode bị trùng/sai màu

- **Vị trí**: [`apps/web/src/shared/ui/period-filter-toolbar.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/period-filter-toolbar.tsx) (dòng 35–46).
- **Nguyên nhân**:
  - Nút active đang dùng class `!bg-slate-900 text-white` ở Light Mode và `dark:!bg-slate-100 dark:!text-slate-900` ở Dark Mode.
  - Ở Light Mode, việc render một khối đen đặc `bg-slate-900` cho segmented control khiến nó giống như nút Primary Action hoặc trùng màu với thanh Dark Navbar, gây xung đột thị giác và không đúng chuẩn Flat Enterprise UI (segmented tabs chuẩn cần nền trắng nổi `!bg-white !text-slate-900 shadow-xs border border-slate-200/60` trên nền `bg-slate-50` / `bg-slate-100` ở Light Mode, và `dark:!bg-slate-800 dark:!text-slate-100` ở Dark Mode).

---

## 2. Thay đổi đề xuất (Proposed Changes)

### Component: Navigation & Layout UI

#### [MODIFY] [app-navigation.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx)

- Cập nhật className của nút đóng menu trong `aside` drawer:
  - Thay `hidden ... max-[960px]:inline-flex` bằng `!hidden max-[960px]:!inline-flex app-nav__close-btn`.
  - Đảm bảo `display: none !important;` có hiệu lực tuyệt đối trên màn hình Desktop (> 960px) và chỉ hiển thị ở mobile drawer (`<= 960px`).

### Component: Shared UI - Period Filter Toolbar

#### [MODIFY] [period-filter-toolbar.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/period-filter-toolbar.tsx)

- Chuẩn hóa style cho Segmented Button Group:
  - **Active State**: `min-h-7 rounded-[2px] !border border-slate-200/80 !bg-white px-2 text-xs font-semibold !text-slate-900 shadow-xs dark:!border-transparent dark:!bg-slate-800 dark:!text-slate-100`
  - **Inactive State**: `min-h-7 rounded-[2px] !border-0 !bg-transparent px-2 text-xs font-medium text-slate-600 hover:!bg-white/80 hover:!text-slate-900 dark:!text-slate-300 dark:hover:!bg-slate-800/80 dark:hover:!text-slate-100`

---

## 3. Kế hoạch kiểm thử (Verification Plan)

### Automated Tests & Typecheck

- Chạy kiểm tra kiểu dữ liệu TypeScript:
  ```bash
  npm run typecheck
  ```
- Chạy linter:
  ```bash
  npm run lint
  ```

### Manual Verification

1. **Kiểm tra nút Đóng menu (`AppNavigation`)**:
   - Màn hình Desktop (> 960px): Nút đóng menu `[X]` hoàn toàn ẩn, layout sidebar cố định gọn gàng.
   - Màn hình Mobile (<= 960px): Mở menu drawer, nút `[X]` hiển thị rõ ràng và bấm đóng drawer hoạt động chính xác.
2. **Kiểm tra Segmented Control (`PeriodFilterToolbar`)**:
   - Ở **Light Mode**: Nút đang chọn (ví dụ: "Tuần") có nền trắng sạch sẽ, viền mảnh tinh tế, chữ `slate-900` đậm nét, tương phản hoàn hảo trên nền `bg-slate-50` / `bg-slate-100`. Nút chưa chọn có nền trong suốt, hover sáng nhẹ.
   - Ở **Dark Mode**: Nút đang chọn có nền `slate-800`, chữ `slate-100`, tương phản tốt trên nền `slate-900`.
