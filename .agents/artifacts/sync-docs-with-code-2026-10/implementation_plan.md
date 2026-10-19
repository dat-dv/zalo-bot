# Kế hoạch: Đồng bộ toàn bộ `.agents/knowledge` (EN) và `.agents/docs` (VI) với code hiện tại

- Route: `implement` · Phase 1 (inspect-and-plan) · Rủi ro: **MEDIUM** (nhiều file, chỉ tài liệu, không đụng code)
- Ngày rà soát: 2026-10-19 · Commit gốc: `fcd727a`

## 1. Hiện trạng

- `node .claude/hooks/docs-drift-check.mjs --all` → **exit 1**: `Module Coverage: Documented module 'finance' ... does not exist in codebase` (chỉ `apps/web/src/modules/*` được tính là module; `finance` là backend `apps/api/src/finance`).
- Rà soát 3 nhóm (global, module A, module B) phát hiện các loại sai lệch chính:
  1. **Tàn dư Telegram**: long polling, inline keyboard/callback, `zalo_LONG_POLLING_ENABLED`, GramJS, `t.me`, `/language`, chữ "zalo" viết thường do find/replace.
  2. **Tính năng không còn tồn tại**: voice/Whisper (`voice-transcription.md`), invite code, trạng thái receipt `ready/missing_fields/not_receipt`, `RECEIPT_IMAGE_*`, `PROXY_ROUTES`, `src/shared/constants`.
  3. **Tên sai / bịa**: `GeminiService` (thực tế `LlmService` + provider gemini/openai/qwen), tool LLM bịa (`create_finance_transaction(s)`, `resolve_finance_place`, `allocate_transaction_to_debts`...; thực tế `RECORD_TRANSACTION`, `MANAGE_DEBT`, `CREATE_PLACE`, `CREATE_TASK`...), `ZaloMessageParserService`→`ZaloMessageParser`, `InputProcessorService`→`InputProcessor`, `thread_configs`→`zca_thread_configs`, `zca:session:...`→`zca:session`, `useDebtAllocationCandidatesQuery`→`useCandidateDebtsQuery`, `AnalyticsSkeleton` không tồn tại.
  4. **Endpoint/route sai**: `POST /api/debts/allocations` (thực tế `/api/transactions/:id/allocations`), `GET /api/zca/login-qr` (thực tế POST), `PATCH thread-configs` (thực tế PUT), `grant-access` là PATCH, redirect exchange về `/dashboard#dashboard_token=`.
  5. **Số liệu sai**: access token 24h (không phải 15 phút), exchange token random+SHA-256 TTL 20 phút (không phải HMAC 5 phút), period grains mặc định `week/month/quarter/year`, thứ tự nạp env.
  6. **Thiếu tài liệu**: `llm/`, `health/` (deploy notify), `redis/`, `ocr/`, `receipt-storage/` (Drive/Photos), `ReminderScheduler` cron 30s, `audit/`, `google-resources.controller` (drive/photos links), các fast-path command (`/today`, `/week`, `/finance`, `/debts`, `/reminders`, `/users`, `/ban`, `/zlogin`, `/zlogout`, `/share`, `/drive`, `/reset`, `/status`), combine places/contacts/debts, categories CRUD, debt payments endpoints, users `sync-zca`/`merge-preview`, ZCA media sync/Photos album/welcome strategy.
  7. **Sai chủ sở hữu component**: Calendar/Reminders/Tasks/Places screen nằm trong `modules/dashboard/presentation/components/`, các module `calendar`, `reminders`, `tasks` chỉ có `api/`; `ExpensesScreen` không còn được route (`/expenses`, `/income` redirect sang `/transactions?type=`).

## 2. Thay đổi đề xuất

### 2.1 Tái cấu trúc (sửa lỗi drift-check)
| Hành động | File |
| --- | --- |
| Xoá | `knowledge/modules/finance/`, `docs/modules/finance/` |
| Tạo mới (thay finance) | `knowledge/global/finance-domain.md` + `docs/global/finance-domain.md` — quy tắc backend: places, allocations, balance adjustment, analytics, combine, categories, debt payments, tool LLM thật |
| Chuyển UX finance | Transactions table, `DeleteTransactionModal`, `DebtAllocationModal`, Analytics → `modules/dashboard/README.md` |
| Di chuyển | `knowledge/domain/financial-report-contracts.md` → `knowledge/global/financial-report-contracts.md` (khớp mirror VI đã có ở `docs/global/`); xoá thư mục `domain/` |
| Xoá | `knowledge/global/voice-transcription.md` + `docs/global/voice-transcription.md` (không có code voice) |
| Tạo mới | `global/llm-providers.md` (EN+VI): `LlmService`, `LLM_PROVIDER`, 3 provider, tool-arguments util, shared context propagation, danh sách 13 tool `ZALO_TOOL_DEFINITIONS` |
| Tạo mới | `global/backend-runtime-services.md` (EN+VI): health/deploy notify, redis, ocr (Tesseract vie+eng), media storage Drive/Photos, reminder scheduler, audit subscriber |

### 2.2 Cập nhật nội dung global (EN + VI tương ứng)
`project-overview.md`, `knowledge/README.md`, `global/README.md` (cả hai), `backend-crud-api`, `backend-exception-filter`, `dashboard-session`, `environment-guard` (danh sách env bắt buộc/tuỳ chọn đúng theo `env.validator.ts`/`configuration.ts`), `google-oauth-public-verification` (thêm `drive.file`, `photoslibrary.appendonly`), `google-tasks`, `i18n`, `local-first-ai-usage`, `monorepo-architecture`, `receipt-image-analysis`, `route-constants` (contracts trong `packages/contracts/src/index.ts`, không BFF proxy), `web-ui-direction` (sửa nhỏ), `zalo-command-intake` (tên class, alias webhook, cooldown, bảng fast-path command), `zalo-response-layout` (bỏ inline keyboard, thêm `pending:tx:user-codes`). `presentation-boundaries`, `type-safety`: giữ nguyên.

### 2.3 Cập nhật module (EN + VI)
- **auth**: `zalo.me`, biến `NEXT_PUBLIC_ZALO_BOT_URL/_USERNAME`, các dạng token capture, storage key, reason `error`, clear & retry.
- **calendar / reminders / tasks**: ghi rõ module chỉ chứa API/query (+ calendar grid/date utils); screen ở dashboard; reminders thêm backend controller + scheduler; tasks thêm fallback & period mặc định.
- **contacts**: bỏ places/external links; thêm trường inline edit, cột linkedUser/resources, combine dialog, invalidation đúng, combine không phải một transaction.
- **dashboard**: sửa hook/endpoint/skeleton/period grains/category input/redirect/session state; thêm CombinePlacesDialog, `?type=` filter, admin strip, UX finance chuyển sang.
- **debts**: sửa mô tả sort, `?status`, cap 200, confirm khi xoá payment, combine/delete mutations; ghi chú lỗi route payment (xem mục 4).
- **expenses**: ghi rõ `ExpensesScreen` không được route; sửa period/invalidation/cột; thêm category filter.
- **settings**: sửa mô tả `ReactScanProvider` (chỉ lưu cờ, chưa nạp profiler).
- **users**: đường dẫn Drive `zalobot/<chatId>`, bỏ invite & thu hồi token, bổ sung entity fields, endpoint `sync-zca`, `GET/PATCH/DELETE :id`, PATCH grant-access, sửa tên test merge.
- **zca**: tên bảng/entity, Redis key, default `requireMention`/`enabled`, thứ tự gate, đủ endpoint, config fields, Photos album, media sync, welcome strategy, pending-image strategies, 13 tool.

### 2.4 Chỉ mục
Cập nhật `.agents/docs/README.md`, `.agents/docs/modules/README.md`, `.agents/knowledge/modules/README.md`, cả hai `global/README.md`, và frontmatter `depends_on` cho file mới/di chuyển.

## 3. Ngoài phạm vi (chỉ báo cáo, KHÔNG sửa code)
Các lỗi code phát hiện được — đề xuất xử lý ở task riêng:
1. **Bug**: web gọi `POST /api/debts/payments` (`API_ROUTES.debtPayments`) nhưng backend chỉ có `POST /api/debts/:id/payments` → Quick Repay khả năng 404 (đã xác minh `packages/contracts/src/index.ts:13`, `finance.controller.ts:548`).
2. `ExpensesScreen` hiển thị cột `paymentMethod`/`currency` mà API không trả về (screen hiện không được route).
3. Toggle React Scan không có tác dụng.
4. Tàn dư Telegram trong code: `window.zalo.WebApp.close()`, `withChatAction('typing'|'upload_photo')`, i18n key nút bấm; env `ZALO_ALLOWED_USER_IDS` thừa, thiếu `ZCA_*`, `OLLAMA_*`, `NEXT_PUBLIC_ZALO_BOT_USERNAME` trong `.env.example`.

## 4. Xác minh
- `node .claude/hooks/docs-drift-check.mjs --all` exit 0.
- `grep -ri "telegram\|long.polling\|GeminiService\|whisper" .agents/knowledge .agents/docs` không còn kết quả (ngoại trừ ghi chú lịch sử nếu cần).
- Kiểm tra link nội bộ trong các README sau khi di chuyển/xoá file.
- Ghi `walkthrough.md` vào cùng thư mục artifact.

## 5. Câu hỏi cần duyệt
- Đồng ý xoá `voice-transcription` (EN+VI) và `modules/finance` (chuyển nội dung sang `global/finance-domain.md` + `modules/dashboard`)?
- Có muốn tách task sửa bug route debt payment ngay không?
