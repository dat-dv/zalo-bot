# Kế hoạch: Dọn biến môi trường dư thừa

- Route: implement · Phase 1 (Planning) · Rủi ro: MEDIUM (nhiều file cấu hình + đổi nhỏ hành vi khởi động ZCA/validator)
- Phạm vi: `.env.example`, `.env`, `.env.production` (2 file sau là local, gitignored), `apps/api/src/config/configuration.ts`, `apps/api/src/config/env.validator.ts` (+ spec), `apps/api/src/zca/zca.service.ts` (+ spec), `docker-compose.yml`, tài liệu env/zca trong `.agents/knowledge` + `.agents/docs`.

## Nguyên tắc

Một biến chỉ nằm trong env khi **giá trị của nó thực sự là lựa chọn của người triển khai** (secret, domain, cổng khác mặc định, công tắc khác mặc định). Biến nào trùng mặc định trong code, hoặc suy ra được từ biến khác, thì bỏ khỏi env. Code vẫn đọc được biến đó (để ghi đè khi cần), chỉ không đưa vào file mẫu.

Đối chiếu đã làm: so giá trị trong `.env` / `.env.production` với mặc định trong `configuration.ts` (chỉ so sánh, không in secret).

## 1. Bỏ khỏi env — không cần sửa code (giá trị = mặc định)

| Biến | Mặc định trong code | Ghi chú |
| --- | --- | --- |
| `DATABASE_SSL=false`, `TYPEORM_SYNCHRONIZE=false` | `false` | compose cũng tự đặt `false` |
| `POSTGRES_DB=zalobot`, `POSTGRES_USER=zalobot` | compose mặc định `zalobot` | |
| `ZCA_LOGGING=false` | `false` | vẫn bật được khi debug |
| `DATA_DIR=./data` | `./data` (nếu có), compose đặt `/app/data` | |
| `GEMINI_MODEL`, `LLM_TIMEOUT_MS=30000` | trùng mặc định | |
| `NOTIFY_ON_STARTUP`, `APP_VERSION` (chỉ trong `.env.example`) | bật ở prod; version lấy từ `package.json` | |
| `PORT`, `GATEWAY_PORT`, `FE_PORT`, `WEB_PORT` (chỉ trong `.env.example`) | alias/legacy, `FE_PORT` mặc định 5173 | |
| `OPENAI_MODEL`, `OPENAI_BASE_URL`, `QWEN_BASE_URL`, `QWEN_MODEL` (example) | trùng mặc định | giữ dạng comment 1 dòng "provider khác: xem docs" |
| Dòng comment rollback `Trước 2026-10-22 ... LLM_PROVIDER=gemini` | — | ghi chú tạm, đã có trong git history |

## 2. Bỏ khỏi env — cần sửa nhỏ trong code

| Biến | Vấn đề hiện tại | Sửa |
| --- | --- | --- |
| **`ZCA_AUTO_LOGIN`** (dòng anh nêu) | Khôi phục phiên đã lưu (`.zca-session.json` → Redis) **luôn chạy** khi khởi động dù cờ là `false`; cờ `true` chỉ khác ở chỗ gọi `login()` cả khi không có phiên (rồi báo lỗi). Cờ này vô nghĩa. | Xoá `autoLogin` khỏi config/`ZcaModuleOptions`. `onApplicationBootstrap`: tự đăng nhập khi có phiên đã lưu **hoặc** có `ZCA_IMEI` + `ZCA_COOKIE`; còn lại bỏ qua (không log lỗi). Hành vi hiện tại của anh (`true` + có session) giữ nguyên. |
| `ZCA_CHECK_UPDATE=false` | `configuration.ts` mặc định `true`, `zca.service.ts` mặc định `false` → mâu thuẫn; bỏ khỏi env sẽ thành `true`. | Đổi mặc định trong `configuration.ts` sang `false`, bỏ khỏi env. |
| `BE_PORT=3005` | Validator bắt buộc `BE_PORT`/`PORT` có giá trị dù config đã mặc định 3005. | Validator chỉ kiểm tra khi có đặt. |
| `DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh` | Validator gọi `Intl` với chuỗi rỗng → lỗi khi không đặt. | Validator chỉ kiểm tra khi có đặt. |
| `WEB_ORIGIN` | = `APP_URL` ở cả 2 file; config đã mặc định theo `APP_URL` nhưng validator bắt buộc. | Validator chỉ kiểm tra khi có đặt. |
| `ZALO_WEBHOOK_URL` | = `APP_URL/webhook` ở cả 2 file. `main.ts` đã fallback, nhưng `zalo.service.ts` và `dashboard-tool.strategy.ts` thì không. | `configuration.ts`: mặc định `${APP_URL}/webhook`. |
| `CORS_ALLOW_ALL` (chỉ bỏ khỏi `.env.example`) | Validator bắt buộc khai báo `true/false`. | Validator chấp nhận để trống (= `false`). `.env` của anh đang `true` nên giữ. |
| `NEXT_PUBLIC_API_URL` | = `APP_URL`; web và API cùng domain nên `httpClient` dùng URL tương đối là đủ. `docker-compose.yml` lại nhét mặc định cứng `https://zalobot.datintech.site`. | Đổi mặc định build arg trong compose sang rỗng; bỏ khỏi env. Vẫn đặt được khi API ở domain khác. |
| `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT` (chỉ trong `.env.example`) | Đăng nhập ZCA giờ làm bằng QR (dashboard / `npm run zca:login`), phiên lưu vào file + Redis. | Bỏ khỏi example; code vẫn đọc (dùng khi cần nạp phiên thủ công). |
| `ZCA_PROXY_URL=http://user:pass@host:port` (example) | Placeholder mà copy nguyên sẽ bị dùng thật → ZCA kết nối qua proxy rác. | Để dạng comment. |

## 3. Giữ lại (giá trị thực sự là lựa chọn)

`NGINX_PORT` (3009 ≠ 3000), `APP_URL`, `CORS_ALLOW_ALL` (`.env`: true), `DATABASE_URL`, `REDIS_URL`, `POSTGRES_PASSWORD`, `BOT_NAME`, `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET_TOKEN`, `ZCA_SELF_LISTEN` (true), `GOOGLE_*`, `DATA_ENCRYPTION_KEY`, `DASHBOARD_*_SECRET`, `DEPLOY_NOTIFY_TOKEN`, `LLM_PROVIDER` (router), `LLM_FALLBACK_PROVIDERS`, `ROUTER_*`, `GEMINI_API_KEY`.

Kết quả: `.env` từ ~37 khoá còn ~22; `.env.example` từ ~55 khoá còn ~25. Comment rút còn 1 dòng/nhóm, chỉ ghi cái không hiển nhiên.

## 4. Lỗi phát hiện kèm (sẽ sửa trong cùng lần này)

- **Dòng hỏng `ZALO_WEBHOOK_SECRET_TOKE`** (thiếu chữ `N`, không có `=`) ở dòng 44 của cả `.env` và `.env.production` → secret webhook hiện **không được đặt**. Sẽ sửa thành `ZALO_WEBHOOK_SECRET_TOKEN=` (để trống, giữ hành vi hiện tại). Muốn bật secret thật thì phải đặt giá trị và đăng ký lại webhook với Zalo — việc đó anh tự làm.

## 5. Cần anh quyết

1. **Xoá luôn các alias legacy trong code?** `BOT_TOKEN`, `WEBHOOK_URL`, `ZALO_BOT_NAME`, `ZCA_DATA_DIR`, `OLLAMA_*`, `PORT`, `GATEWAY_PORT` — không file env nào còn dùng, nhưng rải ở `configuration.ts`, `env.validator.ts`, `scripts/tunnel.sh`, `scripts/zalo-webhook.ts`, `zca.service.ts`, `thread-config.service.ts`, `next.config.ts`, 4 chỗ `process.env.ZALO_BOT_NAME`. Mặc định của kế hoạch: **có xoá** (gom về 1 tên mỗi biến). Nếu anh muốn giữ tương thích thì chỉ dọn env.
2. **`NODE_ENV=development` trong `.env`**: `docker-compose.yml` nạp `.env` trước `.env.production`, nên nếu trên server có file `.env` thì container sẽ chạy `NODE_ENV=development` (ghi đè `ENV NODE_ENV=production` của Dockerfile). Kế hoạch **không sửa** phần này; chỉ báo để anh kiểm tra server.

## 6. Các bước thực hiện (Phase 2)

1. `configuration.ts`: bỏ `autoLogin`; `checkUpdate` mặc định `false`; `webhookUrl` mặc định `${appUrl}/webhook`; (nếu duyệt mục 5.1) bỏ alias.
2. `env.validator.ts`: `BE_PORT`, `WEB_ORIGIN`, `DEFAULT_TIMEZONE`, `CORS_ALLOW_ALL` chỉ kiểm tra khi có đặt; cập nhật `env.validator.spec.ts`.
3. `zca.service.ts` + `zca.interfaces.ts`: logic tự đăng nhập mới; cập nhật/viết test trong `zca.service.spec.ts` (có session → login; có IMEI+COOKIE → login; không có gì → không gọi login).
4. `docker-compose.yml`: build arg `NEXT_PUBLIC_API_URL` mặc định rỗng.
5. Viết lại `.env.example` gọn; sửa `.env` / `.env.production` chỉ bằng cách **xoá dòng** (không đụng giá trị secret) + sửa dòng hỏng mục 4.
6. Docs: `.agents/knowledge/global/environment-guard.md`, `.agents/knowledge/modules/zca/README.md`, `.agents/knowledge/global/monorepo-architecture.md` (nếu đụng alias) và các file `.agents/docs/` tương ứng (tiếng Việt), `.agents/docs/README.md` nếu cần.
7. Kiểm tra: `npm run typecheck --workspace @zalobot/api`, `npm run test --workspace @zalobot/api`, `npm run lint --workspace @zalobot/api`, chạy validator với `.env` mới (khởi động API hoặc gọi `validateEnvironment()`), `node .claude/hooks/docs-drift-check.mjs`.

## Lưu ý

- Working tree đang có thay đổi chưa commit (chat-memory per-thread config) ở `zca.service`-lân cận (`zca-bot-feature.service.ts`, `thread-config.service.ts`). Kế hoạch không đụng nội dung đó; mục 5.1 chỉ sửa 1 dòng alias `ZCA_DATA_DIR` trong `thread-config.service.ts`.
- Rollback: giá trị bị xoá đều là mặc định, thêm lại dòng là khôi phục.
