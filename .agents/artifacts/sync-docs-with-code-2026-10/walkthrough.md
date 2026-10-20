# Walkthrough: Đồng bộ tài liệu với code (2026-10-19)

## Kết quả
- `node .claude/hooks/docs-drift-check.mjs --all` → **PASS (0 errors)** (trước đó lỗi module `finance`).
- Không còn tham chiếu Telegram / long polling / `GeminiService` / Whisper / `modules/finance` / `knowledge/domain` (ngoại trừ câu khẳng định "không tồn tại").
- Link nội bộ và `depends_on` trong `.agents/knowledge` + `.agents/docs`: tất cả trỏ tới file có thật.
- Không sửa code. `apps/api/src/zalo/text/text-input.service{,.spec}.ts` đang bị sửa trong working tree nhưng KHÔNG thuộc task này.

## Thay đổi cấu trúc
- Xoá `modules/finance` (EN+VI). Nội dung backend chuyển sang `global/finance-domain.md`, phần UX chuyển sang `modules/dashboard`.
- Chuyển `knowledge/domain/financial-report-contracts.md` vào `knowledge/global/`, xoá thư mục `domain/`.
- Xoá `global/voice-transcription.md` (EN+VI) vì không có code voice.
- Thêm `global/llm-providers.md`, `global/backend-runtime-services.md`, `global/finance-domain.md` (EN+VI).
- Cập nhật các index: `knowledge/global/README.md`, `knowledge/modules/README.md`, `docs/README.md`, `docs/global/README.md`, `docs/modules/README.md`.

## Nội dung đã viết lại
- Global (EN+VI): project-overview, knowledge README, backend-crud-api, backend-exception-filter, dashboard-session, environment-guard, google-oauth-public-verification, google-tasks, i18n, local-first-ai-usage, monorepo-architecture, receipt-image-analysis, route-constants, web-ui-direction, zalo-command-intake, zalo-response-layout, financial-report-contracts.
- Modules (EN+VI): auth, calendar, contacts, dashboard, debts, expenses, reminders, settings, tasks, users, zca.
- Đính chính so với plan: `ZALO_TOOL_DEFINITIONS` có **14** tool (gồm `GET_STORAGE_LINKS`), không phải 13.

## Lỗi/khoảng trống code phát hiện (đã ghi "known issue" trong docs, chưa sửa)
**Bảo mật**
1. ~~`ZcaController` và 5 endpoint drive/photos trong `google-resources.controller.ts` không kiểm tra dashboard token/admin.~~ → Đã xử lý (commit `7b2720e`, 2026-10-19).
2. ~~`/health/deploy`, `/deploy/*` không có guard.~~ → Đã xử lý (commit `7b2720e`, 2026-10-19).
3. ~~`validateEnvironment()` không được gọi; thiếu env sẽ rơi về default (`CORS_ALLOW_ALL=true`, `DATA_ENCRYPTION_KEY` toàn số 0).~~ → Đã xử lý (commit `7b2720e`, 2026-10-19).

**Chức năng**
4. ~~Quick Repay: web gọi `POST /api/debts/payments`, backend chỉ có `POST /api/debts/:id/payments` → 404.~~ → Đã xử lý (commit `c84c8ca`, 2026-10-19).
5. ~~`MANAGE_DEBT` từ chat: payload thiếu `contactId`/`createNewContact` → `createDebt` từ chối khi xác nhận.~~ → Đã xử lý (commit `c84c8ca`, 2026-10-19).
6. ~~`confirmationRules.requiredHearts` không được truyền vào `createPendingAction` → luôn duyệt với 1 tim.~~ → Đã xử lý (commit `c84c8ca`, 2026-10-19).
7. ~~Debt payment không gắn `financeTransactionId`; xoá payment để lại giao dịch mồ côi.~~ → Đã xử lý (commit `c84c8ca`, 2026-10-19).
8. ~~Trang Transactions chỉ thấy 20 giao dịch tháng hiện tại; `AdjustBalanceModal` dùng số dư tháng thay vì số dư sổ cái.~~ → Đã xử lý (2026-10-20, task `transactions-ledger-api`).
9. Combine places/contacts và xoá transaction không bọc DB transaction; xoá transaction không tính lại `status/settledAt` của nợ.
10. `GET /api/debts` trả cả nợ con (trùng); `ExpensesScreen` (không còn route) hiển thị cột API không trả.
11. Toggle React Scan, `requireConfirm` của expenseTracking/calendarExtraction, reminder `notifyType='call'` không có tác dụng.
12. Không xoá được phone/bank của contact bằng inline edit.

**Vệ sinh**
13. Tàn dư Telegram trong code (`window.zalo.WebApp.close()`, `withChatAction('typing'|'upload_photo')`, i18n key nút bấm), route hardcode (`/api/photos/open` trong `zca-api.ts`, `auth-storage.ts`, `sitemap.ts`), `APP_ROUTES.analytics*` không có trang.
14. `.env.example`: `ZALO_ALLOWED_USER_IDS` thừa; thiếu `ZCA_*`, `OLLAMA_*`, `NEXT_PUBLIC_ZALO_BOT_USERNAME`.
15. `.claude/skills/*/rules/*quality-gates.md` vẫn hướng dẫn ghi vào `.agents/knowledge/domain/` (đã bỏ).
16. Trang `/privacy` chưa liệt kê scope Drive/Photos.

## Chưa xác minh
- Domain production (`zalobot.datintech.site` vs `bot.datintech.site`), route Nginx `/oauth2callback`, chi tiết tiền xử lý OCR.
- Không chạy app/test (thay đổi chỉ là tài liệu).
