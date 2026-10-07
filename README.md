# 🤖 zalobot Monorepo (NestJS, React, PostgreSQL & Google Workspace)

## Cấu trúc Monorepo

```text
apps/api/          NestJS zalo bot và OAuth backend
apps/web/          Next.js Static Export dashboard
packages/contracts/ Kiểu và route constants dùng chung
PostgreSQL          Persistent runtime data
```

Chạy cả API và React: `npm run dev` · Chạy riêng API: `npm run dev:api` · Chạy riêng React: `npm run dev:web` · Build toàn bộ: `npm run build`.

Dashboard mở từ bot cần `APP_URL`, `NEXT_PUBLIC_API_URL`, `DASHBOARD_ACCESS_TOKEN_SECRET` và `DASHBOARD_REFRESH_TOKEN_SECRET`. Khi dùng một domain, đặt cả ba URL public thành `https://zalobot.datintech.site` (không thêm `/api` vào `NEXT_PUBLIC_API_URL`): static Next.js phục vụ các route giao diện, còn Nginx chuyển mọi `/api/*` sang NestJS. `NEXT_PUBLIC_API_URL` được đóng gói vào static output khi build. Không dùng tên `SERVICE_URL_*` vì Coolify dành tiền tố này cho URL được quản lý. Bot tạo link exchange dùng một lần cho từng người dùng; access token có hạn 1 ngày và refresh token có hạn 7 ngày.

Trợ lý cá nhân hoạt động 24/7 trên zalo, được xây dựng bằng **NestJS**, lưu trữ **PostgreSQL (TypeORM)** và hỗ trợ **Đa Người Dùng (Multi-User Isolation)** kết nối độc lập với hệ sinh thái **Google Workspace**.

---

## 🌟 Tính Năng Nổi Bật

- **Mô Hình Đa Người Dùng & PostgreSQL Chuẩn ACID**:
  - Lưu trữ bền vững toàn bộ Users, Invites và Google Tokens trong PostgreSQL.
  - Admin tạo link mời 1 lần `/invite` gửi cho bạn bè/người thân kích hoạt ngay lập tức mà không cần restart bot.
  - Mỗi người dùng tự kết nối tài khoản Google riêng qua lệnh `/login` & `/code` (hoặc AI tự gọi tool `login_google`).
  - Dữ liệu Calendar & Tasks của từng người được cô lập và bảo mật 100%.
- **8 Công Cụ AI Function Calling Tự Động**:
  - `create_calendar_event`: Tạo lịch hẹn có 4 mốc chuông popup báo dồn dập `[60p, 30p, 10p, 0p]`.
  - `list_calendar_events`: Tra cứu lịch trình theo ngày, tuần, tháng.
  - `delete_calendar_event`: Xóa sự kiện Google Calendar.
  - `create_task`: Thêm việc cần làm (To-Do) có hạn chót.
  - `list_tasks`: Tra cứu danh sách việc cần làm.
  - `complete_task`: Đánh dấu hoàn thành việc cần làm.
  - `login_google`: **(MỚI)** AI tự tạo link đăng nhập Google cá nhân hóa khi người dùng hỏi.
  - `create_invite_link`: **(MỚI - Admin Only)** AI tự tạo link mời bạn bè khi Admin ra lệnh.
- **Google Workspace scopes tối thiểu**:
  - Chỉ yêu cầu Calendar và Tasks cùng thông tin định danh cơ bản, đúng với tính năng đang phát hành.
  - Các trang public phục vụ OAuth verification: `/about`, `/privacy`, `/terms`.
- **Private Guard Yêu Cầu Đăng Nhập Google Bắt Buộc**:
  - Chặn người lạ, chỉ cho phép người dùng trong danh sách trắng / được mời.
  - Bắt buộc đăng nhập Google mới được sử dụng các tính năng chat thông thường.
  - Tự động hiển thị nút bấm Inline "🔗 Đăng nhập Google" cho người dùng chưa kết nối.
- **Mô Hình Zero-File-Mount (Cực Kỳ Dễ Deploy Lên Coolify)**:
  - Client ID & Secret cấu hình qua biến môi trường (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
  - Không cần mount file `gcp-oauth.keys.json` hay `.gcp-saved-tokens.json` phức tạp, chỉ cần duy nhất 1 volume `/app/data`.

---

## 📁 Cấu Trúc Dự Án

```text
src/
├── app.module.ts                   # Root module kết nối Config, Schedule, Database, Users, zalo, Google
├── main.ts                         # Entrypoint khởi động NestJS Application Context
├── config/
│   └── configuration.ts            # Load & validate biến môi trường .env
│
├── database/                       # TẦNG CƠ SỞ DỮ LIỆU POSTGRESQL (TYPEORM)
│   ├── database.module.ts          # TypeOrmModule (PostgreSQL)
│   └── entities/                   # UserEntity, InviteEntity, UserTokenEntity
│
├── users/                          # QUẢN LÝ NGƯỜI DÙNG
│   ├── users.service.ts            # TypeORM Repositories, In-Memory Cache, Cooldown
│   └── users.module.ts
│
├── zalo/                           # GIAO DIỆN zalo BOT
│   ├── zalo.module.ts              # ZaloModule
│   ├── zalo.controller.ts          # Webhook endpoint cho Zalo Bot
│   └── zalo.service.ts             # Xử lý webhook events & gửi tin nhắn
│
└── google/                         # TÍCH HỢP GOOGLE WORKSPACE (MULTI-TENANT)
    ├── google.module.ts
    ├── google-auth.service.ts      # Quản lý OAuth2 per-user trong PostgreSQL (user_tokens)
    ├── google-calendar.service.ts  # Tương tác Google Calendar API per-user
    └── google-tasks.service.ts     # Tương tác Google Tasks API per-user
```

---

## ⚙️ Cài Đặt & Cấu Hình

### 1. Cài đặt Dependencies

```bash
npm install
```

### 2. Cấu hình Biến Môi Trường (`.env`)

Tạo file `.env` tại thư mục gốc của dự án:

```env
# 1. zalo BOT
zalo_BOT_TOKEN=your_zalo_bot_token_here
zalo_ADMIN_ID=your_zalo_user_id_here

# 2. GOOGLE OAUTH CREDENTIALS (ZERO-FILE-MOUNT)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 3. BẢO MẬT VÀ DASHBOARD
DATA_ENCRYPTION_KEY=64_hex_characters
DASHBOARD_ACCESS_TOKEN_SECRET=64_random_characters
DASHBOARD_REFRESH_TOKEN_SECRET=another_64_random_characters

# 4. URL PUBLIC
APP_URL=https://zalobot.example.com
# WEB_ORIGIN chỉ cần khi dashboard dùng domain khác APP_URL
WEB_ORIGIN=https://zalobot.example.com
# NEXT_PUBLIC_API_URL được dùng khi build dashboard
NEXT_PUBLIC_API_URL=https://zalobot.example.com

# 5. CALLME
zalo_API_ID=your_zalo_api_id
zalo_API_HASH=your_zalo_api_hash
zalo_SESSION=your_zalo_session
```

---

## 🚀 Khởi Động Ứng Dụng

### Chế độ Development (Hot-Reload):

```bash
npm run start:dev
```

### Chạy nền 24/7 với Docker Compose:

```bash
docker-compose up -d --build
```

### Chạy nền 24/7 với PM2:

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 📚 Bộ Tài Liệu Phát Triển Chi Tiết

Dự án có bộ tài liệu module độc lập tại thư mục [`docs/`](/docs/README.md):

- 🗺️ **[Documentation Hub](file:///Users/datdoan/Documents/projects/zalobot/docs/README.md)**: Bản đồ & lộ trình tra cứu toàn bộ tài liệu dự án.
- 🏛️ **[Kiến trúc hệ thống](file:///Users/datdoan/Documents/projects/zalobot/docs/architecture.md)**: Sơ đồ luồng dữ liệu, PostgreSQL và nguyên lý thiết kế đa người dùng.
- 📅 **[Tích hợp Google Workspace](file:///Users/datdoan/Documents/projects/zalobot/docs/google-integration.md)**: Full Scopes, quản lý Token trong PostgreSQL & mở rộng Gmail/Drive/Sheets.
- 💬 **[Giao diện zalo Bot](file:///Users/datdoan/Documents/projects/zalobot/docs/zalo-bot.md)**: Deep Link Invite, Slash Commands, Private Guard & tối ưu UX.
- 🚀 **[Triển khai & Vận hành](file:///Users/datdoan/Documents/projects/zalobot/docs/deployment.md)**: Cấu hình Zero-File-Mount trên Coolify, Docker, PM2 & Persistent Storage.
- 🛠️ **[Quy chuẩn phát triển](file:///Users/datdoan/Documents/projects/zalobot/docs/development-workflow.md)**: Coding conventions, ESLint/Prettier, Husky hooks & kiểm thử.
