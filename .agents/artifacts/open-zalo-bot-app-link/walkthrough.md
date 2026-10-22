# Walkthrough — Nút "Mở Zalo Bot" mở app Zalo, fallback chat.zalo.me

Plan: [implementation_plan.md](implementation_plan.md) (đã duyệt: Q2 fallback `https://chat.zalo.me`; Q3 chưa sửa trang OAuth bên API).
Điều chỉnh sau duyệt: anh xác nhận **không cần vào thẳng cuộc chat với bot, chỉ cần mở Zalo** → bỏ toàn bộ biến môi trường cấu hình link (thay cho Q1).

## Thay đổi

- **Mới** `apps/web/src/shared/zalo/zalo-app-link.ts`
  - `ZALO_LINKS`: `APP = 'zalo://'` (mở app Zalo ở màn hình chính), `WEB = 'https://chat.zalo.me'`.
  - `launchZalo()` (thuần, inject host để test): điều hướng tới `zalo://`, đợi 1500 ms; nếu có `blur` / `pagehide` / tab bị ẩn thì huỷ; hết giờ thì mở `chat.zalo.me` tab mới, popup bị chặn thì chuyển tab hiện tại.
  - `handleZaloLinkClick()`: onClick cho `<a href={ZALO_LINKS.WEB}>`; chuột giữa / Ctrl/Cmd/Shift/Alt+click giữ hành vi mặc định (mở Zalo Web).
- **Mới** `apps/web/src/shared/zalo/zalo-app-link.spec.ts`: 4 test (hằng link, fallback, popup bị chặn, app mở được thì không fallback).
- `apps/web/src/shared/ui/workspace-header.tsx`: bỏ `getzaloBotUrl()` và `zaloBotUrl` khỏi `useWorkspaceHeader()`; nút dùng `ZALO_LINKS.WEB` + `handleZaloLinkClick`.
- `apps/web/src/shared/ui/app-navigation.tsx`: topbar mobile dùng `ZALO_LINKS.WEB` + `handleZaloLinkClick`.
- `apps/web/src/modules/auth/presentation/components/session-state-screen.tsx`: bỏ bản sao `getzaloBotUrl()`, dùng helper.
- Tài liệu: `knowledge` + `docs` của `modules/auth`, `global/environment-guard` (bỏ dòng env link Zalo Bot), `global/web-ui-direction` (kèm `depends_on` file helper mới).
- Không đổi `Dockerfile`, `docker-compose.yml`, `.env.example` (bản trước có thêm build arg/env, đã gỡ khi bỏ env).

## Lệch so với plan

- Không còn đọc `NEXT_PUBLIC_ZALO_BOT_URL` / `_USERNAME` (và bản viết thường): chúng từng chứa `t.me` / `zalo.me`, và giờ link không cấu hình qua env nữa.

## Kiểm chứng

- `npm run typecheck --workspace @zalobot/web`: pass.
- `npm run lint --workspace @zalobot/web`: pass.
- `npm run test --workspace @zalobot/web`: 63/63 pass (gồm 4 test mới).
- `node .claude/hooks/docs-drift-check.mjs`: PASS (0 errors).
- **Chưa kiểm chứng trên trình duyệt**: `preview_start` lỗi `EPERM: operation not permitted, uv_cwd` (macOS chặn quyền thư mục cho tiến trình preview). Cần thử tay: máy có app Zalo → mở app; máy không có app → tab `chat.zalo.me`.

## Rủi ro / giới hạn

- Chrome desktop có app sẽ hiện hộp thoại "Mở Zalo?"; hộp thoại làm trang mất focus nên huỷ fallback. Nếu người dùng bấm Huỷ thì không có fallback.
- Safari iOS không có app có thể hiện cảnh báo "địa chỉ không hợp lệ" trước khi fallback chạy.
- Trang OAuth thành công bên API (`apps/api/src/google/templates/oauth-html.template.ts`) vẫn dùng `zalo.me` (theo Q3).
