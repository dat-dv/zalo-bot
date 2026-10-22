# Implementation plan — Dọn tàn dư Telegram (web + API)

- Route: `implement` · Phase 1 (Planning) · Authority hiện tại: `inspect-and-plan`
- Rủi ro: **MEDIUM** — nhiều file, đổi chữ người dùng nhìn thấy, đổi lệnh nhanh của bot (`/start`). Không đổi DB schema, không đổi API HTTP.
- Branch đề xuất: `chore/remove-telegram-leftovers` (đang ở `main`, working tree sạch).

## Bối cảnh

Lần chuyển Telegram → Zalo trước đây thay hàng loạt chữ "Telegram" thành "zalo" nhưng giữ nguyên cơ chế cũ. Kết quả: không còn chữ "Telegram" trong code, nhưng còn các khái niệm chỉ Telegram có (Mini App `WebApp`, `t.me`, chat action `upload_photo`, lệnh `/start`, nút inline keyboard), cùng chữ "zalo" viết thường lọt ra giao diện.

## Phạm vi thay đổi

### A. API — ChatAction → typing

ZCA chỉ có một tín hiệu "đang gõ" (`ZcaService.sendTyping`); tham số `action` hiện bị bỏ qua (`_action`).

1. `apps/api/src/zca/zca-messenger.service.ts`
   - Xoá `export type ChatAction = 'typing' | 'upload_photo'`.
   - Đổi tên và bỏ tham số `action`: `sendChatAction` → `sendTyping(chatId)`, `startChatAction` → `startTyping(chatId, intervalMs?)`, `withChatAction` → `withTyping(chatId, fn)`. Hành vi giữ nguyên (heartbeat 4 s, cleanup idempotent, no-op khi ZCA chưa đăng nhập).
2. Cập nhật nơi gọi: `zca/text/text-input.service.ts` (3 chỗ), `zca/text/strategies/search-chat-history-tool.strategy.ts` (2 chỗ).
3. **Lỗi tiềm ẩn phát hiện khi khảo sát**: `zca/pending-image/strategies/create-bill-pending-image.strategy.ts` kiểm tra `'withChatAction' in this.zcaService`, nhưng `ZcaService` không có hàm này → luồng tạo hoá đơn từ ảnh **không bao giờ hiện "đang gõ"**. Sửa: inject `@Optional() ZcaMessengerService` và gọi `withTyping`; bỏ nhánh duck-typing `withChatAction` trong kiểu union của `zcaService`. (Nếu gặp vòng phụ thuộc DI thì dùng `forwardRef` như `ZcaService` đang dùng.)
4. Spec: `zca-messenger.service.spec.ts`, `text-input.service.spec.ts`, `search-chat-history-tool.strategy.spec.ts`, `pending-image/pending-image.spec.ts` — đổi tên mock/test theo API mới.

### B. API — lệnh `/start`

`/start` là lệnh Telegram tự gửi khi mở bot; Zalo không có cơ chế này, và alias `start` trần đang nuốt mọi tin nhắn chỉ có chữ "start". Nội dung lời chào vẫn có ích nên **giữ tính năng, đổi tên và đổi lệnh kích hoạt**:

1. `text-tool.enum.ts`: `START` → `WELCOME`.
2. `strategies/start-tool.strategy.ts` → `strategies/welcome-tool.strategy.ts`, class `WelcomeToolStrategy`; cập nhật `text-tool.providers.ts`, `text-tool.factory.ts` (tham số constructor, `strategyMap`).
3. `resolveFastPathToolType`: bỏ `/start`, `/start …`, `start`; thay bằng `/gioithieu`, `giới thiệu`, `gioi thieu` (khớp chính xác hoặc lệnh + khoảng trắng, theo quy ước hiện có).
4. `help-tool.strategy.ts`: thêm dòng `• /gioithieu - Lời chào & giới thiệu bot` vào mục lệnh nhanh (hiện lời chào không được liệt kê ở đâu).
5. Comment `text-input.service.ts:149` liệt kê `/start` → cập nhật.
6. Spec: `text-tool.factory.spec.ts`, `text-input.service.spec.ts`, `bot-mention.util.spec.ts` (đổi ví dụ `/start 123` sang `/help 123` — test chỉ kiểm tra việc bỏ mention).

> **Cần bạn quyết**: (a) bộ lệnh mới `/gioithieu` + `giới thiệu`/`gioi thieu` có ổn không; (b) có giữ `/start` làm alias im lặng (không ghi trong /help) để người quen tay vẫn dùng được không. Mặc định của plan: **bỏ hẳn `/start`**.

### C. Web — trang công khai `/about`, `/privacy`, `/terms`

1. `app/about/page.tsx`: nút "Mở Zalo để bắt đầu" đang trỏ `https://t.me` → dùng `ZALO_LINKS.WEB` + `onClick={handleZaloLinkClick}` từ `@/shared/zalo/zalo-app-link` (giống `SessionStateScreen`; thử mở app Zalo trước rồi fallback Zalo Web). `rel="noopener noreferrer"`.
2. Logo chữ **"TB"** (Telegram Bot) ở header cả 3 trang → thay bằng brand mark chữ Z. Tạo atom dùng chung `src/shared/ui/brand-mark.tsx` render `<img src="/icon.svg" alt="" aria-hidden>` cùng kích thước `size-7` và `rounded-[5px]` hiện có (giữ radius nhỏ). Ba trang dùng chung atom này thay vì lặp markup.

### D. Web — Mini App `WebApp`

`apps/web/src/modules/auth/presentation/components/session-state-screen.tsx`: xoá `ZaloWebApp`, `getzaloWebApp`, state `isInsidezalo`, `useEffect` dò `window.zalo.WebApp`, `handleCloseMiniApp` và nút "Đóng cửa sổ". Zalo không inject global này nên nút không bao giờ hiện → không đổi hành vi thấy được.

### E. i18n catalog `packages/contracts/src/index.ts` (cả `vi` và `en`)

1. Xoá key chết (không nơi nào dùng): `zalo.language.updated`, `zalo.language.choose`, `zalo.reminders.empty`, `zalo.reminders.fetchError`, `zalo.reminders.cancelButton`, `zalo.reminders.refresh`, `zalo.reminders.close`, `auth.closeMiniApp`.
2. Đổi tên key cho đúng chữ hoa: `auth.openzaloBot` → `auth.openZaloBot`, `public.about.zalo` → `public.about.openZalo` (cập nhật nơi dùng).
3. Sửa "zalo" viết thường → "Zalo" trong: `table.idModal.agentPromptTitle`, `auth.openZaloBot` ("Mở Zalo Bot"), `auth.accessCode.desc`, `reminders.subtitle`, `reminders.create.description`, `public.about.eyebrow` ("TRỢ LÝ CÁ NHÂN TRÊN ZALO" / "YOUR PERSONAL ZALO ASSISTANT"), `public.about.openZalo`, `public.terms.accountDescription`, `public.privacy.dataDescription` ("ID người dùng Zalo" / "Zalo user ID").
4. Viết lại câu theo luồng Mini App ("Hãy mở lại từ zalo bot") sang luồng đăng nhập bằng mã hiện tại:
   - `dashboard.error.desc`: "Phiên làm việc đã hết hạn. Nhắn \"dashboard\" cho bot Zalo để nhận mã đăng nhập mới."
   - `auth.loggedOut.desc`: "Phiên làm việc của bạn đã kết thúc an toàn. Nhắn \"dashboard\" cho bot Zalo để nhận mã đăng nhập mới."
   - `auth.sessionExpired.desc`: "Phiên truy cập đã hết hạn hoặc không tìm thấy thông tin đăng nhập. Nhắn \"dashboard\" cho bot Zalo để nhận mã đăng nhập mới."
   - Bản `en` tương ứng.

### F. Web — metadata

`app/layout.tsx` (description ×3, keyword `'zalo bot'`), `app/manifest.ts` (description), `app/(private)/reminders/page.tsx` (description): "zalo" → "Zalo".

### G. Tài liệu (Hard Completion Gate)

| Knowledge (EN) | Docs (VI) | Nội dung |
| --- | --- | --- |
| `global/zalo-command-intake.md` | `global/zalo-command-intake.md` | Dòng `/start, start → START` → `/gioithieu, giới thiệu, gioi thieu → WELCOME`. |
| `global/llm-providers.md` | `global/llm-providers.md` | Ví dụ lệnh nhanh `/start` → `/help`. |
| `global/zalo-response-layout.md` | `global/zalo-response-layout.md` | Ghi `withTyping` (một tín hiệu "đang gõ"; luồng hoá đơn ảnh cũng hiện). |
| `modules/auth/README.md` | `modules/auth/README.md` | Bỏ mục nút "Close mini app". |
| `global/pwa.md` | `global/pwa.md` | Ghi chú brand mark Z cũng dùng ở header trang công khai (thay "TB"). |

`.agents/docs/README.md` không thêm/bớt file nên chỉ cập nhật nếu drift-check yêu cầu.

## Ngoài phạm vi (không làm)

- `/privacy` chưa liệt kê scope Drive/Photos (tồn đọng cũ, không phải Telegram).
- Lời chào nói "Gõ /login để liên kết" với cả người không phải admin, trong khi `/login` chỉ dành cho admin — ghi nhận, không sửa.
- `CHANGELOG.md` và artifact cũ có nhắc Telegram là lịch sử, giữ nguyên.
- Cột DB `chat_id`, `source_chat_id`, kiểu `'sticker'` là khái niệm chung, không phải tàn dư.

## Kiểm tra

1. `npm run typecheck` · `npm run lint` · `npm run test` (api, web, contracts).
2. `npm run build --workspace @zalobot/web` (static export).
3. Grep phải rỗng trong `apps/` và `packages/`: `t\.me`, `\.WebApp`, `closeMiniApp`, `ChatAction`, `upload_photo`, `'/start'`, `zalo\.language\.`, `zalo\.reminders\.`, `\bTB\b` trong JSX; và không còn chữ "zalo" viết thường trong chuỗi hiển thị (trừ `zalobot`, `zalo://`, key `source.zalo`, giá trị enum `'zalo'`).
4. Mở `/about` trên dev server: nút mở Zalo hoạt động, header hiện logo Z; xem màn hình hết phiên.
5. `node .claude/hooks/docs-drift-check.mjs` thoát 0.

## Rollback

Toàn bộ nằm trong một branch, không migration → revert commit là đủ.
