# Implementation plan: env prod cho Cognee + truy cập Cognee từ xa qua `/cognee`

Route: implement · Phase 1 · Rủi ro: **TRUNG BÌNH–CAO** (mở một service ra internet, sửa file secret production) · Ngày: 2026-10-25 · Branch: `feat/chat-memory-v2`

## 1. Yêu cầu

1. Cập nhật `.env.production` để deploy Cognee.
2. Nginx trỏ `https://<domain>/cognee/...` vào service `cognee` để truy cập từ xa.
3. Câu hỏi: Cognee dùng LLM 9router của mình được không? (Trả lời ở mục 5.)

## 2. Hiện trạng

- Web chạy `nginx:1.27-alpine`; template `apps/web/nginx.conf` được copy vào `/etc/nginx/templates/` (envsubst lúc khởi động). Đang proxy `/api/` và `/oauth2callback` sang `api`.
- Service `cognee` (thêm ở commit trước, chưa commit) không mở cổng, chỉ nằm trong network của compose. Cognee bật access control, nên mọi API đều phải đăng nhập.

## 3. Rủi ro khi mở `/cognee` ra internet

- `POST /api/v1/auth/register` của Cognee **cho bất kỳ ai tự tạo tài khoản**. Người lạ không đọc được dataset của mình (access control), nhưng có thể nạp dữ liệu vào dataset của họ và **đốt LLM/key 9router của anh**.
- Trang `/docs` (Swagger) liệt kê toàn bộ API.
- Tài khoản dịch vụ `zalobot@example.com` có quyền superuser; lộ mật khẩu là lộ toàn bộ trí nhớ của mọi kênh.

## 4. Thay đổi đề xuất

### 4.1 Nginx (`apps/web/nginx.conf`, `apps/web/Dockerfile`, `docker-compose.yml`)

- `location /cognee/` → `proxy_pass http://cognee:8000/` (bỏ tiền tố `/cognee`). Dùng `resolver 127.0.0.11` + biến upstream, để web vẫn khởi động được khi `cognee` tắt hoặc chưa sẵn sàng (nginx không chết với lỗi "host not found").
- Timeout dài (`proxy_read_timeout 600s`, `client_max_body_size 20m`) cho `remember`.
- **Bảo vệ bằng Basic Auth của nginx** (lớp thứ hai, trước cả đăng nhập của Cognee):
  - Env mới `COGNEE_PROXY_USER`, `COGNEE_PROXY_PASSWORD` truyền vào service `web`.
  - Script `/docker-entrypoint.d/30-cognee-htpasswd.sh` (copy từ `apps/web/`) sinh `/etc/nginx/cognee.htpasswd` lúc khởi động.
  - Thiếu một trong hai biến thì `/cognee/` trả **404**: mặc định đóng, không bao giờ mở trần.
- Chặn hẳn `location = /cognee/api/v1/auth/register` (403), kể cả khi đã qua Basic Auth.
- API dùng được qua `https://<domain>/cognee/api/v1/...`. Swagger `/cognee/docs` có thể không tải được, vì FastAPI gọi `/openapi.json` theo đường tuyệt đối; em sẽ kiểm tra khi làm, không được thì ghi lại giới hạn này. API nội bộ (bot → `http://cognee:8000`) không đổi.

### 4.2 `.env.production` (file không theo dõi trong git)

Thêm các dòng sau, **không in giá trị ra màn hình**:

| Khoá | Giá trị |
| --- | --- |
| `COGNEE_URL` | `http://cognee:8000` (khớp danh sách Coolify) |
| `COGNEE_USER_PASSWORD` | sinh ngẫu nhiên 32 ký tự |
| `COGNEE_JWT_SECRET` | sinh ngẫu nhiên 48 ký tự |
| `COGNEE_LLM_PROVIDER` | `custom` |
| `COGNEE_LLM_ENDPOINT` | lấy từ `ROUTER_BASE_URL` (chuẩn hoá về `.../v1`) |
| `COGNEE_LLM_MODEL` | `openai/` + `ROUTER_MODEL` |
| `COGNEE_LLM_API_KEY` | lấy từ `ROUTER_API_KEY` |
| `COGNEE_PROXY_USER` | `zalobot` |
| `COGNEE_PROXY_PASSWORD` | sinh ngẫu nhiên 24 ký tự |

- Script chỉ ghi thêm, không đọc hay ghi đè khoá khác; khoá đã có thì bỏ qua.
- Trước đó em bị chặn quyền đọc giá trị env. Nếu lần này lại bị chặn, em đưa anh đoạn lệnh để tự chạy.
- Mật khẩu proxy và mật khẩu Cognee anh xem trực tiếp trong file, em không đưa vào chat.
- Cập nhật `.env.example` (comment `COGNEE_PROXY_*`) và `environment-guard.md` (EN + VI).

### 4.3 Tài liệu

`modules/zca/chat-memory.md` (EN + VI): mục truy cập từ xa (đường dẫn, Basic Auth, register bị chặn, Swagger), cùng `global/environment-guard.md`.

## 5. Trả lời: Cognee dùng LLM 9router được không?

**Được, về kỹ thuật.** Cognee gọi endpoint OpenAI-compatible qua `LLM_PROVIDER=custom` + `LLM_ENDPOINT=<router>/v1` + `LLM_MODEL=openai/<model>`. Lúc chạy thử, em đã gọi từ container Cognee tới 9router và nhận được trả lời của chính 9router, tức là đường kết nối và định dạng đều đúng. Tuy vậy:

- **9router đang hỏng:** model sau alias trả **410** (model đã ngừng phục vụ), còn model thay thế báo thiếu credential openrouter. Chừng nào 9router chưa sửa thì Cognee, và cả bot (đang rơi về Gemini), đều không dùng được nó.
- Cognee dựng graph bằng JSON có cấu trúc; model miễn phí có thể trả JSON hỏng (Cognee tự thử lại 3 lần). Phải đo sau khi 9router chạy lại.
- Dự phòng nếu 9router không ổn: trỏ `COGNEE_LLM_*` sang Gemini (`COGNEE_LLM_PROVIDER=gemini`, `COGNEE_LLM_MODEL=gemini/<model>`, key Gemini).

## 6. Kiểm thử

- `docker compose config -q`; build image web; chạy nginx local với một upstream giả để kiểm tra:
  - Không đặt biến proxy thì `/cognee/` trả 404.
  - Thiếu Basic Auth thì 401; đúng Basic Auth thì `/cognee/health` trả 200.
  - `/cognee/api/v1/auth/register` trả 403.
  - `/api/` và trang web vẫn chạy như cũ.
- `node .claude/hooks/docs-drift-check.mjs`.
- Chưa kiểm được trên production; anh deploy rồi thử `curl -u zalobot:<mật khẩu> https://<domain>/cognee/health`.

## 7. Ngoài phạm vi

Giao diện web riêng của Cognee (`cognee-frontend`), MCP server, subdomain riêng, sửa 9router.
