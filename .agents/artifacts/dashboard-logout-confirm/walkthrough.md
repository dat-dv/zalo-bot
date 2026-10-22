# Walkthrough: Xác nhận trước khi đăng xuất dashboard

Kế hoạch: [implementation_plan.md](implementation_plan.md) (đã duyệt).

## Thay đổi
- `apps/web/src/shared/ui/logout-confirm-dialog.tsx` (mới): hộp `LogoutConfirmDialog` dựa trên `Modal`, `role="alertdialog"`, nút Huỷ + Đăng xuất (rose), khoá nút và không cho đóng khi đang đăng xuất.
- `apps/web/src/shared/ui/workspace-header.tsx`: hook `useWorkspaceHeader` thay `handleLogout` bằng `isLogoutConfirmOpen`, `isLoggingOut`, `requestLogout`, `cancelLogout`, `confirmLogout`; nút Đăng xuất ở header desktop mở hộp.
- `apps/web/src/shared/ui/app-navigation.tsx`: nút Đăng xuất ở chân sheet Thêm (điện thoại/PWA) mở hộp, hộp chồng lên sheet.
- `packages/contracts/src/index.ts`: key `common.logoutConfirm.title`, `common.logoutConfirm.message`, `common.loggingOut` (vi + en).
- Tài liệu: `.agents/knowledge/global/web-ui-direction.md`, `.agents/docs/global/web-ui-direction.md`.

## Kiểm tra đã chạy
- `npm run typecheck` (contracts, web): pass.
- `npm run lint --workspace @zalobot/web`: pass.
- `npm run build --workspace @zalobot/web`: pass (static export).
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm được
- Chưa xem trực tiếp trên browser pane: `preview_start` lỗi `EPERM uv_cwd` (macOS chặn quyền truy cập `~/Documents` của tiến trình khởi động dev server). Cần xem tay trên desktop và điện thoại/PWA.
