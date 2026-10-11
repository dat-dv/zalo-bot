# 🚀 Hướng Dẫn Triển Khai & Vận Hành (Deployment Guide)

Tài liệu này hướng dẫn toàn bộ quy trình thiết lập môi trường local, đóng gói Docker, chạy tiến trình nền với PM2 và triển khai tự động CI/CD lên VPS qua Coolify với PostgreSQL và Redis.

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

- **Node.js**: Phiên bản 20.x hoặc 22.x LTS.
- **NPM**: Phiên bản 10.x trở lên.
- **Docker & Docker Compose** (nếu chạy dạng container).
- **Tài khoản Google Cloud** đã kích hoạt Calendar API & Tasks API.
- **Zalo Bot Token** tạo từ Zalo Bot Platform (`bot-api.zaloplatforms.com`).

---

## 2. Cấu Hình Biến Môi Trường (`.env`)

Tạo file `.env` tại thư mục gốc từ mẫu `.env.example`:

```bash
cp .env.example .env
```

Nội dung chi tiết các biến chính:

```env
APP_URL=https://zalobot.example.com
WEB_ORIGIN=https://zalobot.example.com
NEXT_PUBLIC_API_URL=https://zalobot.example.com

ZALO_BOT_TOKEN=replace-with-zalo-bot-token
ZALO_WEBHOOK_URL=https://zalobot.example.com/webhook
ZALO_WEBHOOK_SECRET_TOKEN=optional-secret-token
ZALO_ADMIN_ID=your-admin-zalo-user-id

DATA_ENCRYPTION_KEY=64-hex-characters
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
DASHBOARD_ACCESS_TOKEN_SECRET=64-random-characters
DASHBOARD_REFRESH_TOKEN_SECRET=another-64-random-characters

LLM_PROVIDER=qwen
QWEN_BASE_URL=http://localhost:11434
QWEN_MODEL=qwen2.5:14b
```

---

## 3. Quy Trình Đăng Nhập Google 100% Qua zalo

Không cần chạy lệnh terminal `npm run auth` hay sinh file token thủ công:

1. Mở bot trên zalo và gõ: `/login` (hoặc bấm nút **"🔗 Đăng nhập Google"**).
2. Đăng nhập Gmail trên trình duyệt và bấm **Cho phép (Allow)**.
3. Copy mã xác thực trả về và gửi lại cho bot:
   ```
   /code 4/0AQ...
   ```
4. Toàn bộ Token của **Admin** và **Bạn bè** được tự động lưu trữ và quản lý độc lập, bảo mật trong **PostgreSQL (bảng `user_tokens`)**!

---

## 4. Chạy Ở Môi Trường Local

```bash
# Cài đặt dependencies
npm install

# Chạy chế độ watch (hot-reload khi sửa code)
npm run start:dev

# Kiểm tra lint & format
npm run lint
npm run format

# Build mã nguồn
npm run build

# Chạy bản build production
npm run start:prod
```

---

## 5. Triển Khai Với Docker & Docker Compose

### 1. Build & Khởi động Container

```bash
docker-compose up -d --build
```

### Chạy hạ tầng Local cho việc phát triển (PostgreSQL, Redis, Nginx Gateway)

Để chạy các dịch vụ hạ tầng nền phục vụ cho việc phát triển local với hot-reload (`npm run dev`):

```bash
npm run docker:local
# hoặc: docker compose -f docker-compose.local.yml up -d
```

Để dừng các container hạ tầng:
```bash
npm run docker:local:down
# hoặc: docker compose -f docker-compose.local.yml down
```

### 2. Xem logs & trạng thái

```bash
# Xem log realtime của bot
docker logs -f zalo-assistant-bot

# Dừng container
docker-compose down
```

> [!NOTE] Compose dùng Docker volumes `zalobot-postgres`, `zalobot-redis` và `zalobot-receipts`. `zalobot-receipts` được mount vào `/app/data` để giữ ảnh bill đã nén qua các lần redeploy. Khi deploy bằng Coolify, cũng cần cấu hình persistent storage mount vào `/app/data`.

---

## 6. Triển Khai Tự Động Với Coolify (Khuyên Dùng Cho Production)

Coolify cho phép triển khai dự án tự động thông qua GitHub App Webhook mỗi khi push code lên nhánh `main`.

### Các bước cấu hình trên Coolify (Cực kỳ đơn giản):

1. **Tạo Application mới**: Chọn **Public / Private Repository** và liên kết với repo GitHub của bạn.
2. **Chọn Build Pack**: Chọn **Dockerfile**.
3. **Cấu hình Environment Variables**:
   - Dán các biến từ `.env` vào mục **Environment Variables**. Đặt `APP_URL` và `WEB_ORIGIN` là runtime variables; đặt `NEXT_PUBLIC_API_URL` là build variable trước lần build Dashboard.
   - Không dùng `SERVICE_URL_zaloBOT`: Coolify dành tiền tố `SERVICE_URL_*` cho URL do nền tảng quản lý.
4. **Cấu hình database**:
   - Dùng PostgreSQL và Redis services trong `docker-compose.yml`.
   - Khai báo `POSTGRES_PASSWORD` trong Environment Variables; Compose tự tạo `DATABASE_URL` nội bộ cho API.
5. **Kích hoạt Auto Deploy**:
   - Bật Webhook trong Coolify.
   - Mỗi lần bạn thực hiện `git push origin main`, Coolify sẽ tự động build lại Docker image và cập nhật ứng dụng sau 10-20 giây!

---

## 7. Chạy Nền Với PM2 (Nếu Không Dùng Docker)

File cấu hình `ecosystem.config.cjs` đã được thiết lập sẵn:

```bash
# 1. Cài đặt PM2 global nếu chưa có
npm install -g pm2

# 2. Build dự án
npm run build

# 3. Khởi chạy với PM2
pm2 start ecosystem.config.cjs

# 4. Lưu danh sách tiến trình để tự khởi động khi server reboot
pm2 save
pm2 startup

# 5. Xem logs & giám sát
pm2 logs nestjs-zalo-assistant
pm2 monit
```

---

## 8. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Hiện tượng                                                 | Nguyên nhân                                           | Cách khắc phục                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Bot báo `Yêu cầu kết nối tài khoản Google`                 | Chưa đăng nhập Google OAuth.                          | Bấm nút **"🔗 Đăng nhập Google"** hoặc gõ `/login` rồi gửi `/code <mã>`. |
| Người lạ nhắn tin báo `Truy cập bị từ chối`                | Chưa được Admin mời qua link `/invite`.               | Admin gõ `/invite` lấy link gửi cho bạn, hoặc gõ `/allow <id>`.          |
| Lỗi `Google OAuth credentials chưa được cấu hình`          | Thiếu `GOOGLE_CLIENT_ID` hoặc `GOOGLE_CLIENT_SECRET`. | Kiểm tra lại các biến môi trường trên Coolify hoặc file `.env`.          |

## 9. Khởi tạo PostgreSQL trống

Với database PostgreSQL hoàn toàn mới, đặt `TYPEORM_SYNCHRONIZE=true` cho đúng một lần deploy để TypeORM tạo schema. Khi API khởi động thành công, đổi biến này thành `false` và deploy lại. Luôn giữ `DATABASE_URL` hợp lệ; API sẽ từ chối khởi động nếu thiếu cấu hình PostgreSQL.
