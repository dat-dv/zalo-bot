# Implementation plan: Giao diện Cognee, `/cognee` chuyển sang UI

Route: implement · Phase 1 · Rủi ro: **TRUNG BÌNH** (thêm service, mở thêm một host ra internet) · Ngày: 2026-10-26 · Branch: tạo `feat/cognee-ui` từ `main`

## 1. Yêu cầu

Anh Đạt cần giao diện web đơn giản cho Cognee; vào `https://zalobot.datintech.site/cognee` thì được chuyển sang giao diện đó.

## 2. Ràng buộc đã kiểm chứng (source v1.6.5 + tài liệu "Run the UI Locally")

- Image chính thức `cognee/cognee-ui:1.6.5` (Next.js standalone, cổng 3000, khoảng 114 MB).
- `COGNEE_BACKEND_URL` đọc lúc chạy và **được trình duyệt dùng trực tiếp**: phải là URL tuyệt đối mà trình duyệt truy cập được, chỉ gồm scheme + host + port; UI tự nối `/api/v1/...`.
- Đăng nhập bằng **cookie gắn với host**; backend chỉ cho phép origin trong `UI_APP_URL` / `CORS_ALLOWED_ORIGINS`.
- `next.config.ts` **không có `basePath`**, nên UI không chạy được dưới `/cognee/` mà phải ở gốc của một host.

## 3. Thiết kế

Dùng **một subdomain riêng**, ví dụ `cognee.datintech.site`. UI và API cùng nằm trên host đó, nên cookie và CORS đều cùng origin, không vướng gì:

```text
https://zalobot.datintech.site/cognee   ──302──►  https://cognee.datintech.site/
https://cognee.datintech.site/          ──► nginx (web) ──► cognee-ui:3000
https://cognee.datintech.site/api/...   ──► nginx (web) ──► cognee:8000/api/...
```

- Toàn bộ host `cognee.…` nằm sau **Basic Auth** (`COGNEE_PROXY_USER` / `COGNEE_PROXY_PASSWORD` đã có), sau đó mới tới màn đăng nhập của UI (`zalobot@example.com` + `COGNEE_USER_PASSWORD`).
- `POST /api/v1/auth/register` vẫn luôn trả 403.
- Trên domain chính: `/cognee` và `/cognee/` chuyển 302 sang UI; `/cognee/api/...` và `/cognee/health` giữ nguyên làm lối vào API như hiện tại.
- Thiếu `COGNEE_UI_HOST` hoặc thiếu biến proxy thì không có server block cho UI, và `/cognee` trả 404 như bây giờ (mặc định đóng).

## 4. Thay đổi

1. **`docker-compose.yml`**:
   - Service `cognee-ui`: image `cognee/cognee-ui:1.6.5`, không mở cổng, `COGNEE_BACKEND_URL=https://${COGNEE_UI_HOST}`, healthcheck.
   - Service `cognee`: thêm `UI_APP_URL=https://${COGNEE_UI_HOST}` (CORS).
   - Service `web`: thêm env `COGNEE_UI_HOST`.
2. **`apps/web/30-cognee-htpasswd.sh`**:
   - Khi có `COGNEE_UI_HOST` + biến proxy, ghi thêm file `/etc/nginx/cognee-ui.server`: một `server { server_name $COGNEE_UI_HOST; … }` có Basic Auth, `location = /api/v1/auth/register` (403), `location /api/` → `cognee:8000`, `location /` → `cognee-ui:3000` (có upgrade websocket). Upstream phân giải theo request qua Docker DNS, nên một service chết không làm nginx chết.
   - Thêm `location = /cognee` và `location = /cognee/` → `return 302 https://$COGNEE_UI_HOST/;` vào `cognee.locations`.
3. **`apps/web/nginx.conf`**: `include /etc/nginx/cognee-ui.server;` ở cấp `http` (cạnh server chính). Nginx của image đọc `conf.d/*.conf`, nên file sẽ được ghi vào `/etc/nginx/conf.d/zz-cognee-ui.conf` (rỗng khi tắt), không cần sửa template.
4. **`.env.production`**: thêm `COGNEE_UI_HOST=cognee.datintech.site`. **`.env.example`**: thêm dòng comment.
5. **Tài liệu**: `modules/zca/chat-memory.md` (EN + VI, mục truy cập UI), `global/environment-guard.md` (EN + VI).

## 5. Kiểm thử (local, Docker)

Chạy `cognee` + `cognee-ui:1.6.5` + nginx của web trong một network, giả lập host bằng header `Host:`:
- Host UI thiếu Basic Auth trả 401; có Basic Auth thì `/` trả 200 (trang UI) và `/api/v1/auth/login` đăng nhập được, cookie được set.
- `/api/v1/auth/register` trả 403.
- Domain chính `/cognee` trả 302 tới `https://cognee.datintech.site/`; `/cognee/health` vẫn 200; trang web và `/api/` không đổi.
- Thiếu biến thì `/cognee` trả 404 và nginx vẫn khởi động.

Không kiểm được: HTTPS và cookie `Secure` trên domain thật, DNS, Coolify.

## 6. Việc anh làm sau khi deploy

1. Tạo DNS `cognee.datintech.site` trỏ về server (giống `zalobot.…`).
2. Trên Coolify, thêm domain `https://cognee.datintech.site` cho service **web** (cùng service với domain chính) và khai báo `COGNEE_UI_HOST`.
3. Vào `https://zalobot.datintech.site/cognee` → nhập Basic Auth → đăng nhập UI bằng `zalobot@example.com` / `COGNEE_USER_PASSWORD`.

## 7. Giới hạn

- Các trang Activity, Analytics, Memory Coverage chỉ có trên Cognee Cloud; Datasets, Search, Graph dùng được.
- Graph chỉ có nội dung khi job đêm nạp được, tức là sau khi 9router hết lỗi 410.
- Tài khoản `zalobot@example.com` là superuser, nên ai đăng nhập UI thấy và xoá được trí nhớ của mọi kênh.
