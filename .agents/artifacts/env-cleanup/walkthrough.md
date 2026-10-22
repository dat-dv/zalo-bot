# Walkthrough: Dọn biến môi trường dư thừa

Thực hiện theo [implementation_plan.md](implementation_plan.md), có làm mục 5.1 (xoá alias legacy).

## Đã làm

- **Config** (`apps/api/src/config/configuration.ts`): bỏ `autoLogin`; `checkUpdate` mặc định `false`; `webhookUrl` mặc định `${APP_URL}/webhook`; `DATA_DIR` mặc định `./data`; bỏ alias `PORT`, `BOT_TOKEN`, `ZALO_BOT_NAME`, `WEBHOOK_URL`, `ZCA_DATA_DIR`, `OLLAMA_*`.
- **Validator** (`env.validator.ts`): `BE_PORT`, `NGINX_PORT`, `WEB_ORIGIN`, `ZALO_WEBHOOK_URL`, `CORS_ALLOW_ALL`, `DEFAULT_TIMEZONE` chỉ kiểm tra khi có khai báo. Spec thêm 2 test (env tối thiểu hợp lệ; giá trị tùy chọn sai bị bắt).
- **ZCA** (`zca.service.ts`, `zca.interfaces.ts`): bỏ cờ `ZCA_AUTO_LOGIN`. Khi khởi động, server tự đăng nhập nếu có `ZCA_IMEI` + `ZCA_COOKIE` hoặc có phiên đã lưu; không có thì chỉ ghi log. Thêm 3 test.
- **Alias ở chỗ gọi**: `process.env.ZALO_BOT_NAME` (4 file), `ZCA_DATA_DIR` (`zca.service.ts`, `thread-config.service.ts`, `scripts/zca-login.ts`), `BOT_TOKEN`/`WEBHOOK_URL` (`scripts/zalo-webhook.ts`, giờ có fallback `APP_URL/webhook`), `GATEWAY_PORT` (`next.config.ts`, `docker-compose.local.yml`, `scripts/tunnel.sh`), `WEB_PORT` (`docker-compose.yml`), `SECRET_TOKEN` (`tunnel.sh`).
- **`scripts/tunnel.sh`**: chế độ gateway ghi `APP_URL` (thêm dòng nếu chưa có); chế độ trỏ thẳng backend ghi `ZALO_WEBHOOK_URL` (thêm dòng nếu chưa có). Các biến suy ra chỉ bị ghi đè khi đang được khai báo.
- **`docker-compose.yml`**: build arg `NEXT_PUBLIC_API_URL` mặc định rỗng (web gọi API cùng domain).
- **Env files**: `.env.example` viết lại (~20 khoá). `.env` / `.env.production`: chỉ xoá dòng (15 khoá trùng mặc định/suy ra + 5 comment), không đụng giá trị secret. Bản sao lưu trước khi sửa nằm trong scratchpad của phiên.
- **Docs**: environment-guard, zca README, dashboard README, monorepo-architecture, llm-providers (knowledge EN + docs VI).

## Khác với kế hoạch

- **Mục 4 (dòng `ZALO_WEBHOOK_SECRET_TOKE`)**: kế hoạch tưởng dòng này rỗng. Thực tế nó có giá trị (9 ký tự) nhưng sai tên khoá nên chưa bao giờ có hiệu lực. **Không sửa**: đổi tên sẽ bật kiểm tra secret, webhook đang đăng ký không kèm secret sẽ bị trả 403. Để lại cho anh quyết.
- Thêm mặc định `DATA_DIR=./data` trong code (kế hoạch ghi là đã có): fallback cũ dùng thư mục chạy nếu `./data` chưa tồn tại, khác với giá trị `./data` đã khai báo trước đó.
- Commit `133273f` (chat-memory, tạo song song) đã gom sẵn một phần thay đổi này: README zca (EN + VI) và dòng `ZCA_DATA_DIR` trong `thread-config.service.ts`.

## Kiểm tra

- `npm run typecheck` (toàn repo): pass.
- `npm run test --workspace @zalobot/api`: 438/438 pass.
- Validator chạy với `.env` mới: hợp lệ; config suy ra đúng (`port` 3005, `webOrigin` = `APP_URL`, webhook = `APP_URL/webhook`, `checkUpdate` false).
- `node .claude/hooks/docs-drift-check.mjs`: pass.
- `npm run lint`: api và web đều fail do lỗi có sẵn ở các dòng không thuộc task này (`transaction-confirmation.service.ts`, `zca-bot-feature.service.ts`, `text-input.service.ts:344`, `zca.service.spec.ts:486`, web `zca-query.ts`). Các file em sửa không có lỗi mới. `eslint --fix` có tự sửa `welcome-group-event.strategy.spec.ts`; em đã hoàn tác.
- Chưa kiểm tra: build Docker thật, chạy `tunnel.sh` thật, khởi động API với ZCA thật.

## Còn lại

- ~~3 file mẫu env trùng lặp~~: đã xoá `apps/api/.env.example`, `apps/web/.env.example`, `apps/web/.env.local.example` theo yêu cầu; sửa environment-guard (EN + VI) và `docs/zalo-bot.md` (bỏ nhắc `ZALO_ALLOWED_USER_IDS`). Các artifact cũ nhắc tới các file này là lịch sử, giữ nguyên.
- `NODE_ENV=development` trong `.env`: nếu server có file `.env` thì container sẽ chạy ở chế độ development.
