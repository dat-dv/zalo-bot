# Walkthrough: Chuyển Theme & Money Visibility sang Zustand

Đã làm theo `implementation_plan.md` (phương án mặc định: **không** chuyển LocaleProvider).

## Thay đổi code
- Thêm `zustand@^5.0.15` vào `apps/web`.
- Tạo mới `apps/web/src/shared/store/theme-store.ts` (`useThemeStore`, `useTheme`) và `money-visibility-store.ts` (`useMoneyVisibilityStore`, `useMoneyVisibility`, `useMoneyFormatter`; chỉ lưu trong bộ nhớ, không dùng `persist`).
- Thêm test `money-visibility-store.spec.ts` (3 test: mặc định ẩn, toggle, set).
- `app-providers.tsx`: bỏ `ThemeProvider` và `MoneyVisibilityProvider`; gọi `useThemeStore.getState().syncFromDocument()` trong effect lúc mount.
- Đổi đường dẫn import ở 17 file; xoá `theme-provider.tsx` và `money-visibility-provider.tsx`.

## Tài liệu
- Knowledge (EN): `global/web-ui-direction.md` (thêm mục Global Client UI State, cập nhật depends_on), `global/README.md`, `modules/dashboard/README.md`, `modules/debts/README.md`.
- Docs (VI): `global/web-ui-direction.md` (thêm mục State giao diện dùng chung), `modules/dashboard/README.md`, `modules/debts/README.md`, `docs/README.md`.

## Kiểm tra
- `npm run typecheck` (web): pass.
- `npm run test` (web): 29/29 pass.
- `npm run build` (web): pass, static export.
- `prettier --check` trên các file đã sửa: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- `npm run lint` (web): **fail 1 lỗi có từ trước, không liên quan**: `src/modules/zca/api/zca-query.ts:25` biến `SyncThreadMediaResponse` không dùng. File này không bị sửa trong task.
- **Chưa kiểm tra trên browser**: dev server không khởi động được trong browser pane (`EPERM uv_cwd`, lỗi quyền truy cập thư mục).
