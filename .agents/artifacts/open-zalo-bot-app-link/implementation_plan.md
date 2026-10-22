# Implementation Plan — Nút "Mở Zalo Bot" mở app Zalo, fallback chat.zalo.me

Route: `implement` · Phase 1 (inspect-and-plan) · Rủi ro: THẤP–TRUNG BÌNH (chỉ web, không đụng API/DB)

## 1. Hiện trạng (đã kiểm tra)

Nút "Mở Zalo Bot" (`auth.openzaloBot`) xuất hiện ở 3 chỗ, đều là thẻ `<a href={url} target="_blank">`:

| Vị trí | Nguồn URL |
| --- | --- |
| `apps/web/src/shared/ui/workspace-header.tsx` (header desktop, khi chưa đăng nhập) | `getzaloBotUrl()` cục bộ |
| `apps/web/src/shared/ui/app-navigation.tsx:255` (topbar mobile) | `zaloBotUrl` lấy từ `useWorkspaceHeader()` |
| `apps/web/src/modules/auth/presentation/components/session-state-screen.tsx` (màn hết phiên / đã đăng xuất) | bản sao thứ hai của `getzaloBotUrl()` |

Logic hiện tại (lặp 2 lần): `NEXT_PUBLIC_ZALO_BOT_URL` → `https://zalo.me/<NEXT_PUBLIC_ZALO_BOT_USERNAME>` → `https://zalo.me`.

**Nguyên nhân lỗi:** link là `https://zalo.me/...` mở trong tab mới. Trên desktop (và trong PWA/standalone, nơi universal link không được chuyển cho app) trình duyệt chỉ hiện trang web zalo.me, không mở app Zalo; cũng không có nhánh fallback về `chat.zalo.me`.

## 2. Hành vi mong muốn

Khi bấm "Mở Zalo Bot":
1. Thử mở **app Zalo** bằng deep link (scheme `zalo://`).
2. Nếu sau ~1,5 giây trang vẫn đang hiển thị (không có `visibilitychange` → hidden / `pagehide` / `blur`, tức là app không bắt link) → mở **`https://chat.zalo.me`** (Zalo Web) ở tab mới.
3. Nếu app mở được → huỷ timer, không mở thêm tab.

## 3. Thay đổi đề xuất

### 3.1. Helper dùng chung (mới) — `apps/web/src/shared/zalo/zalo-bot-link.ts`
- `resolveZaloBotLinks(env)` (hàm thuần, dễ test): trả về `{ appUrl, webUrl }`.
  - `appUrl`: `NEXT_PUBLIC_ZALO_BOT_APP_URL` nếu có; nếu không, dựng từ ID/username bot (xem câu hỏi mở Q1).
  - `webUrl`: `NEXT_PUBLIC_ZALO_BOT_WEB_URL` nếu có; mặc định `https://chat.zalo.me`.
  - Vẫn đọc các tên env cũ (`NEXT_PUBLIC_ZALO_BOT_URL`, `NEXT_PUBLIC_ZALO_BOT_USERNAME`, và bản viết thường legacy) để không phá cấu hình đang chạy.
- `openZaloBot(links)` (client): gán `window.location.href = appUrl`, đặt timer 1500 ms; lắng nghe `visibilitychange`/`pagehide`/`blur` để huỷ timer; hết giờ thì `window.open(webUrl, '_blank', 'noopener,noreferrer')`. Dọn listener sau khi xong.
- Hằng số URL (`chat.zalo.me`, scheme `zalo://`) đặt `as const` trong file này (không phải route nội bộ nên không vào `APP_ROUTES`).

### 3.2. Dùng helper ở 3 nút
- `workspace-header.tsx`: xoá `getzaloBotUrl()`; `useWorkspaceHeader()` trả `zaloBotLinks` + `handleOpenZaloBot` thay cho `zaloBotUrl`.
- `app-navigation.tsx`: dùng `handleOpenZaloBot`.
- `session-state-screen.tsx`: xoá bản sao `getzaloBotUrl()`, dùng helper.
- Thẻ `<a>` giữ `href={webUrl}` (để middle-click / mở tab mới / không JS vẫn ra chat.zalo.me), bỏ `target="_blank"` mặc định và thêm `onClick` gọi `event.preventDefault()` + `openZaloBot()`; giữ nguyên class/style (radius nhỏ hiện có).

### 3.3. Test — `apps/web/src/shared/zalo/zalo-bot-link.spec.ts`
- `resolveZaloBotLinks`: các tổ hợp env (có APP_URL, chỉ có username, không có gì → `webUrl = https://chat.zalo.me`, tên env legacy).
- `openZaloBot` với `window`/`document` giả: (a) không có visibility change → mở `webUrl` sau timeout; (b) có `visibilitychange` hidden → không mở fallback.

### 3.4. Tài liệu (Hard Completion Gate)
- `.agents/knowledge/global/environment-guard.md` + `.agents/docs/global/environment-guard.md`: env mới / mặc định mới.
- `.agents/knowledge/modules/auth/README.md` + `.agents/docs/modules/auth/README.md`: hành vi nút "Mở Zalo Bot".
- `.agents/knowledge/global/web-ui-direction.md` + `.agents/docs/global/web-ui-direction.md`: sửa câu "default `https://zalo.me`".
- `.env.example`: thêm `NEXT_PUBLIC_ZALO_BOT_APP_URL` / `NEXT_PUBLIC_ZALO_BOT_WEB_URL` (comment ví dụ).
- Chạy `node .claude/hooks/docs-drift-check.mjs` đến khi exit 0.

## 4. Ngoài phạm vi (không sửa trừ khi anh yêu cầu)
- `apps/api/src/google/templates/oauth-html.template.ts` — trang "Kết nối Google thành công" cũng có nút quay về `https://zalo.me/<bot>`. Có thể áp dụng cùng logic (script inline) ở bước sau.

## 5. Câu hỏi mở (cần anh xác nhận trước khi làm)
- **Q1 — Deep link của bot:** Bot đang cấu hình bằng `NEXT_PUBLIC_ZALO_BOT_URL` hay `NEXT_PUBLIC_ZALO_BOT_USERNAME`, giá trị dạng gì (ID số, username, hay số điện thoại)? Scheme `zalo://` không có tài liệu chính thức cho bot, nên em đề xuất:
  - mặc định chỉ mở `zalo://` (mở app Zalo ở màn chính) nếu không biết link chat trực tiếp với bot;
  - cho phép đặt `NEXT_PUBLIC_ZALO_BOT_APP_URL` để trỏ thẳng vào cuộc chat với bot khi anh có link chính xác.
- **Q2 — Fallback:** chỉ `https://chat.zalo.me` (trang chủ Zalo Web), hay anh muốn kèm tham số mở thẳng cuộc chat với bot?
- **Q3:** Có áp dụng luôn cho trang OAuth thành công bên API (mục 4) không?

## 6. Kiểm chứng
- `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`, `npm run test --workspace @zalobot/web`.
- Mở preview web (chưa đăng nhập), bấm nút: trên máy không có app → tab `chat.zalo.me`; kiểm tra console không lỗi. Trường hợp có app Zalo cần anh thử trên máy thật (trình duyệt pane không mở được app native).
