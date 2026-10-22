# Walkthrough: Bỏ Zalo Bot chính thức, gộp vào ZCA, mã đăng nhập cố định

- Plan: [implementation_plan.md](implementation_plan.md) — đã duyệt phương án A (admin riêng `dashboard-owner`), giữ lệnh `/dashboard`.
- Nơi làm: worktree `.claude/worktrees/remove-zalo-official-bot`, nhánh `refactor/remove-zalo-official-bot`, tách từ `2d9190a` (để không đụng phiên "Lưu task vào database riêng" đang sửa cùng file).

## Đã làm

### A. Bỏ kênh Zalo Bot chính thức
- Xoá: `ZaloController` (`/webhook` + 3 alias), `ZaloMessageParser`, DTO webhook, `zalo.constants.ts`, các file re-export cũ trong `zalo/`, `zalo.module.ts`, `webhook-raw-body-debug.middleware.ts`, `apps/api/scripts/zalo-webhook.ts`, 4 script `zalo:webhook:*`.
- **Khác plan**: `InputProcessor` bị xoá thay vì chuyển sang `zca/` — kiểm tra lại thì chỉ webhook gọi nó; ZCA đi thẳng `ZcaBotFeatureService` → `TextInputService`.
- Chuyển `zalo/text/**` → `zca/text/**` (giữ tên class). Danh sách strategy tách ra `zca/text/text-tool.providers.ts`.
- `ZaloService` → `ZcaMessengerService` (`zca/zca-messenger.service.ts`), chỉ dùng ZCA: giữ chia tin >1900 ký tự (cách 300 ms) như bản cũ, `sendChatAction` dùng `sendTypingEvent` của ZCA. Đổi tên ở toàn bộ chỗ dùng (biến `zaloService` → `zcaMessenger`).
- `ZcaModule` nhận toàn bộ provider của `ZaloModule` (+ `AuditModule`); `app`, `google`, `health`, `reminders` import `ZcaModule`. Hết vòng import Zalo↔Zca.
- Config/env: bỏ `ZALO_BOT_TOKEN` (hết bắt buộc), `ZALO_WEBHOOK_URL`, `ZALO_WEBHOOK_SECRET_TOKEN`; bỏ `rawBody`, prefix exclude webhook, log webhook trong `main.ts`.
- Nginx (`apps/web/nginx.conf`, `docker/nginx/nginx.local.conf.template`) và service worker bỏ `/webhook`, `/zalo/`.
- `scripts/tunnel.sh`: vẫn chạy tunnel + ghi `APP_URL`, bỏ setWebhook/testWebhook, thử kết nối bằng `/api/docs`.
- `DashboardToolStrategy`: bỏ đọc `ZALO_WEBHOOK_URL`, chỉ dùng `APP_URL`.
- Lệnh `/ping` trả "Bot đang hoạt động bình thường" (bỏ chữ webhook). Web: chú thích dòng "Người dùng" ở `/zca` nhắc ID cũ và `dashboard-owner`.

### B. Mã đăng nhập cố định
- `DASHBOARD_LOGIN_CODE` (tuỳ chọn) — kiểm định dạng lúc khởi động (`env.validator.ts`).
- `ReportsTokenService.matchesStaticLoginCode`: so hash SHA-256 bằng `timingSafeEqual`.
- `POST /api/access/code`: rate limit chạy trước → khớp mã env thì `UsersService.ensureDashboardOwner()` (tạo/trả lại quyền admin cho `dashboard-owner`, tên "Chủ hệ thống") + log `warn` kèm IP; không khớp thì đi luồng mã 1 lần như cũ.

## Kiểm chứng (đã chạy trong worktree)
- `npm run typecheck` api / web / contracts: pass.
- `npm run lint` api / web: pass.
- `npm run test` api: 504/504 pass (có spec mới: `zca-messenger.service.spec.ts` viết lại, `reports-token.service.spec.ts`, `users-dashboard-owner.spec.ts`, 2 case env validator); web: 69/69 pass.
- `npm run build --workspace @zalobot/api`: pass.
- `node .claude/hooks/docs-drift-check.mjs` và `--all`: PASS.

## Chưa kiểm chứng
- **Chưa chạy API thật**: khởi động API bằng `.env` thật sẽ tự đăng nhập ZCA bằng phiên đã lưu và đá phiên đang chạy của bot. DI graph mới chỉ được kiểm bằng `app.module.spec.ts` (scan module) + build. Cần chạy thử sau khi merge: khởi động API, nhắn bot 1 tin, gọi `POST /api/access/code` với mã env.
- Hiệu ứng "đang soạn tin" qua ZCA là hành vi mới trên kênh ZCA (trước đây chỉ chạy khi có token Bot API).

## Tài liệu đã cập nhật
- `.agents/knowledge` + `.agents/docs`: `global/zalo-command-intake`, `dashboard-session`, `environment-guard`, `monorepo-architecture`, `pwa`, `zalo-response-layout`, `receipt-image-analysis`, `local-first-ai-usage`, `backend-runtime-services`, `backend-crud-api`, README index; `modules/zca` (README, chat-memory, channel-storage), `modules/users`, `modules/auth`, `project-overview.md`; đường dẫn `zalo/text` → `zca/text` trong `depends_on`.
- `CONTEXT.md`: thêm thuật ngữ "Chủ hệ thống (`dashboard-owner`)", sửa "Danh tính kênh Zalo".
- `README.md` và `docs/*.md` (trừ các plan lịch sử trong `docs/superpowers/plans/`).

## Merge về main
Phiên "Lưu task vào database riêng" đang sửa (chưa commit) các file mà nhánh này đã di chuyển/sửa: 6 strategy task trong `zalo/text/strategies/`, `text-tool.definitions.ts`, `zalo.module.ts`, `zca.module.ts`, `reports.controller.ts`. Khi merge cần: chuyển các thay đổi đó sang đường dẫn `zca/text/...`, đổi `ZaloService`/`zaloService` thành `ZcaMessengerService`/`zcaMessenger`, và đăng ký provider mới (nếu có) trong `zca/text/text-tool.providers.ts` thay vì `zalo.module.ts`.
