# Kế hoạch: Xác nhận trước khi đăng xuất dashboard (desktop + điện thoại/PWA)

Rủi ro: **MEDIUM** (sửa nhiều file UI dùng chung, không đụng API/DB/auth backend).

## Hiện trạng

Có 2 chỗ đăng xuất dashboard, đều gọi thẳng `handleLogout()` từ hook `useWorkspaceHeader()` (`apps/web/src/shared/ui/workspace-header.tsx`), bấm là thoát luôn, không hỏi lại:

| Nơi | File | Màn hình |
| --- | --- | --- |
| Nút "Đăng xuất" trên header | `workspace-header.tsx:223` | Desktop (> 960px) |
| Nút "Đăng xuất" ở cuối sheet "Thêm" (More) | `app-navigation.tsx:430` | Điện thoại / tablet / PWA (≤ 960px) |

Nút "Đăng xuất ZCA" ở `/zca` (`zca-screen.tsx:217`) là việc khác (ngắt tài khoản Zalo cá nhân của bot) và **đã có** `window.confirm`.

## Hướng làm

Dùng một hộp xác nhận trong app (dựng trên `Modal` sẵn có) thay vì `window.confirm`, vì:
- Trên PWA iOS/Android, `window.confirm` hiện hộp thoại hệ thống kèm tên miền, trông lạc lõng và không theo dark mode.
- `Modal` đã lo sẵn: phone (< 640px) là bottom sheet có vuốt xuống để huỷ, safe-area đáy, khoá cuộn trang, chuyển động; desktop là thẻ giữa màn hình; Escape để huỷ.
- `Modal` dùng `<dialog>.showModal()` nên mở chồng lên sheet "Thêm" được mà không cần chỉnh z-index; bấm Huỷ thì quay về sheet "Thêm".

### 1. Hook `useWorkspaceHeader` (`workspace-header.tsx`)
- Thêm state: `isLogoutConfirmOpen`, `isLoggingOut`.
- Trả thêm: `requestLogout()` (mở hộp), `cancelLogout()` (đóng, bị chặn khi đang đăng xuất), `confirmLogout()` (logic `handleLogout` hiện tại, bật `isLoggingOut`).
- Bỏ `handleLogout` khỏi giá trị trả ra để không còn đường nào đăng xuất mà không qua xác nhận.

### 2. Component mới `LogoutConfirmDialog` (`apps/web/src/shared/ui/logout-confirm-dialog.tsx`)
- Props: `open`, `isPending`, `onCancel`, `onConfirm`.
- `Modal` với `role="alertdialog"`, `labelledBy`/`describedBy`, `dismissOnBackdrop`; khi `isPending` thì không truyền `onDismiss` (không huỷ được giữa chừng).
- Nội dung: tiêu đề "Đăng xuất?", mô tả ngắn, 2 nút: **Huỷ** (viền xám) và **Đăng xuất** (màu rose, giống nút đăng xuất ở sheet "Thêm"). Khi pending: cả 2 nút disabled, nút chính đổi chữ "Đang đăng xuất…".
- Panel `max-w-sm rounded-[3px]` (giữ bo góc nhỏ theo quy ước), nút dùng `MODAL_FOOTER_TAP` để cao 40px và chia đều hàng trên điện thoại.
- Focus mặc định rơi vào panel (hành vi sẵn của `Modal`), không tự focus nút Đăng xuất để tránh Enter nhầm.

### 3. Gắn vào 2 nơi
- `WorkspaceHeader`: nút Đăng xuất gọi `requestLogout`; render `<LogoutConfirmDialog />`.
- `AppNavigation` (sheet "Thêm"): nút Đăng xuất gọi `requestLogout`; render `<LogoutConfirmDialog />` cạnh sheet. Sheet "Thêm" vẫn mở bên dưới.
- Mỗi component tự gọi hook nên có state riêng; tại một kích thước màn hình chỉ một trong hai nút hiển thị.

### 4. i18n (`packages/contracts/src/index.ts`, cả `vi` và `en`)
| Key | vi | en |
| --- | --- | --- |
| `common.logoutConfirm.title` | Đăng xuất? | Log out? |
| `common.logoutConfirm.message` | Bạn sẽ cần mở lại link đăng nhập từ Zalo Bot để vào dashboard. | You'll need a new sign-in link from the Zalo Bot to get back in. |
| `common.loggingOut` | Đang đăng xuất… | Logging out… |

Dùng lại `common.cancel`, `common.logout`.

### 5. Tài liệu (Hard Completion Gate)
- `.agents/knowledge/global/web-ui-direction.md` (EN): ghi rõ Logout ở header và sheet "Thêm" đều mở `LogoutConfirmDialog` (alertdialog, bottom sheet trên phone), hook chỉ cho `requestLogout`/`confirmLogout`.
- `.agents/docs/global/web-ui-direction.md` (VI): giải thích lý do (tránh bấm nhầm trên điện thoại vì nút nằm sát các ô điều hướng, đăng xuất phải xin lại link từ Zalo).
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## Ngoài phạm vi (mặc định không làm)
- Đổi `window.confirm` của "Đăng xuất ZCA" và các hộp xoá khác sang dialog trong app. Có thể làm sau nếu anh muốn đồng bộ, vì `LogoutConfirmDialog` có thể tổng quát hoá thành `ConfirmDialog`.

## Kiểm tra
1. `npm run typecheck --workspace @zalobot/web` và `--workspace @zalobot/contracts`, `npm run lint --workspace @zalobot/web`.
2. Xem trên preview (browser pane):
   - Desktop: bấm Đăng xuất → hộp hiện giữa màn hình; Huỷ / Escape / bấm nền đều đóng, vẫn đăng nhập.
   - Mobile (375×812): mở "Thêm" → Đăng xuất → bottom sheet chồng lên sheet "Thêm"; Huỷ / vuốt xuống quay lại sheet "Thêm"; dark mode hiển thị đúng.
   - **Không bấm nút xác nhận Đăng xuất trong browser pane** (phiên đăng nhập test là link dùng một lần). Luồng đăng xuất thật giữ nguyên logic cũ nên chỉ kiểm bằng code review.
