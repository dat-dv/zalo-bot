# Walkthrough — Dọn tàn dư Telegram (web + API)

- Plan: [implementation_plan.md](implementation_plan.md), được duyệt 2026-10-22 với lựa chọn: lệnh `/gioithieu` + `giới thiệu`/`gioi thieu`, **bỏ hẳn `/start`**.
- Branch: `chore/remove-telegram-leftovers` (chưa commit).

## Đã làm

### API
- `ZcaMessengerService`: bỏ kiểu `ChatAction`; `sendChatAction`/`startChatAction`/`withChatAction` → `sendTyping`/`startTyping`/`withTyping` (không còn tham số action). Hành vi giữ nguyên.
- Luồng tạo hoá đơn từ ảnh (`CreateBillPendingImageStrategy`): inject `@Optional() ZcaMessengerService` (tham số cuối) và bọc lời gọi LLM bằng `withTyping`. Trước đây strategy được DI cấp `ZcaService` (không có `withChatAction`) nên trong production **không bao giờ hiện "đang soạn tin"**; chỉ đường auto-wire trong test mới có. Đường auto-wire trong `TextInputService` truyền thêm messenger.
- `/start` → `TextToolType.WELCOME`, `WelcomeToolStrategy` (`welcome-tool.strategy.ts`, `git mv`). Fast path nhận `/gioithieu`, `/gioithieu …`, `giới thiệu`, `gioi thieu`; `/start` và `start` giờ trả `null` (đi vào LLM). `/help` có thêm dòng `/gioithieu`.
- Spec cập nhật theo tên mới; thêm assert `/start` và `start` không còn là lệnh nhanh.

### Web
- `/about`: nút "Mở Zalo để bắt đầu" dùng `ZALO_LINKS.WEB` + `handleZaloLinkClick` thay cho `https://t.me`.
- Atom mới `src/shared/ui/brand-mark.tsx` (`BrandMark`, `icon.svg` 28px, `rounded-[5px]`) thay huy hiệu chữ "TB" ở header `/about`, `/privacy`, `/terms`.
- `SessionStateScreen`: bỏ `window.zalo.WebApp`, state `isInsidezalo` và nút "Đóng cửa sổ".
- Metadata (`layout.tsx`, `manifest.ts`, `reminders/page.tsx`): "zalo" → "Zalo".

### i18n (`packages/contracts`, vi + en)
- Xoá 8 key chết: `zalo.language.*` (2), `zalo.reminders.*` (5), `auth.closeMiniApp`.
- Đổi tên key: `auth.openzaloBot` → `auth.openZaloBot`, `public.about.zalo` → `public.about.openZalo`.
- Sửa chữ "zalo" viết thường; câu "Hãy mở lại từ zalo bot" → "Nhắn "dashboard" cho bot Zalo để nhận mã đăng nhập mới".

### Tài liệu
- `global/zalo-command-intake.md` (EN + VI): bảng lệnh `/gioithieu` → `WELCOME`, ghi chú bỏ `/start`; mô tả typing `withTyping` (gồm luồng hoá đơn ảnh).
- `global/llm-providers.md` (EN + VI): ví dụ `/start` → `/help`.
- `global/web-ui-direction.md` (EN + VI): tên key `auth.openZaloBot`.
- `global/pwa.md` (EN + VI): `BrandMark` trên trang công khai; thêm `brand-mark.tsx` vào `depends_on`.
- `modules/auth/README.md` (EN + VI): bỏ mục nút "Đóng mini app".

**Lệch so với plan**: ghi chú typing đặt ở `zalo-command-intake.md` (nơi vốn đã mô tả typing) thay vì `zalo-response-layout.md`; drift-check vẫn PASS.

## Kiểm tra đã chạy
- `npm run typecheck` (api, web, contracts): sạch — sau khi `npm run build --workspace @zalobot/contracts`, vì web đọc kiểu từ `packages/contracts/dist` (bị git ignore).
- `npm run lint`: sạch.
- `npm run test`: 594/594 + 116/116 pass.
- `npm run build --workspace @zalobot/web`: thành công (static export).
- Grep `apps/` + `packages/`: không còn `t.me`, `.WebApp`, `closeMiniApp`, `ChatAction`, `upload_photo`, `'/start'` (trừ assert phủ định trong spec), key `zalo.language.*`/`zalo.reminders.*`, `openzaloBot`, huy hiệu `TB`.
- Bundle build: chunk `/about` chứa `chat.zalo.me` và `/icon.svg`, không còn `https://t.me`.
- `node .claude/hooks/docs-drift-check.mjs`: PASS (0 errors).

## Chưa xác minh
- Không mở được trang trong browser pane: tiến trình preview không có quyền đọc `~/Documents` (EPERM). Giao diện `/about`, logo Z và màn hình hết phiên chưa được nhìn tận mắt.
- Chưa thử trên Zalo thật: `/gioithieu` và "đang soạn tin" ở luồng hoá đơn ảnh.
- Người quen gõ `/start` giờ nhận câu trả lời của LLM thay vì lời chào (đúng lựa chọn đã duyệt).
