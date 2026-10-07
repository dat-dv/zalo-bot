# Kế Hoạch Xử Lý Triệt Để Lỗi Crash Backend (zalo 409 Conflict & GramJS 406 Error Handling)

## 1. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Qua kiểm tra log và mã nguồn:

1. **Lỗi GramJS (`406: AUTH_KEY_DUPLICATED`)**:
   - `zaloCallerService` đã có `try/catch` bắt lỗi khi `client.connect()`. Tuy nhiên, khi gặp lỗi này, client chưa được gọi `client.disconnect()` triệt để để giải phóng socket/timer ngầm.
2. **Nguyên nhân chính gây Crash Backend (`zaloError: 409 Conflict`)**:
   - Thư viện `nestjs-zalograf` trong hàm khởi tạo `createBotFactory` tự động gọi `bot.launch(options.launchOptions)` dưới dạng asynchronous Promise mà **không hề có `.catch()`**.
   - Khi chạy long polling và xảy ra xung đột `409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running` (do có 1 instance bot khác đang chạy song song hoặc request polling cũ chưa kịp timeout), zalograf ném ra ngoại lệ `zaloError: 409`.
   - Lỗi này trở thành **Unhandled Promise Rejection** tại runtime Node.js v20. Theo cơ chế mặc định của Node.js, unhandled promise rejection sẽ lập tức terminate (kill) tiến trình backend (`process.exit(1)`).
   - Khi tiến trình NestJS API bị dừng đột ngột, service `[web]` (Next.js) cố gắng proxy request tới `http://localhost:3000` dẫn đến lỗi hàng loạt `ECONNREFUSED`.
3. **Thiếu Global Process Error Guards**:
   - File `apps/api/src/main.ts` chưa đăng ký global event handlers (`unhandledRejection`, `uncaughtException`), khiến bất kỳ lỗi async không mong muốn từ thư viện bên ngoài đều làm crash toàn bộ server.

---

## 2. Giải Pháp Đề Xuất (Proposed Solutions)

### A. Quản lý vòng đời zalo Polling chủ động (`zaloLauncherService`)

- Cấu hình `launchOptions: false` trong `zalografModule.forRootAsync` để ngăn chặn `nestjs-zalograf` tự động launch unhandled.
- Xây dựng `zaloLauncherService` (implement `OnApplicationBootstrap` và `OnApplicationShutdown`):
  - Chạy `bot.launch()` với `try/catch` bọc kín.
  - Phân loại lỗi:
    - Nếu là `409 Conflict`: Ghi log cảnh báo `[zaloLauncher] ⚠️ Phát hiện bot instance khác đang chạy trùng token (409 Conflict). Tạm hoãn polling và tự động thử lại sau 15 giây...` mà **KHÔNG làm crash NestJS Web Server**.
    - Nếu là lỗi mạng thông thường (ETIMEDOUT, ECONNRESET, 502): Tự động retry với backoff.
  - Dọn dẹp polling sạch sẽ (`bot.stop()`) khi server shutdown.

### B. Bổ sung Global Process Error Guards trong `main.ts`

- Bổ sung `process.on('unhandledRejection', ...)` và `process.on('uncaughtException', ...)` trong `apps/api/src/main.ts` để ghi log chi tiết thay vì để Node.js terminate runtime.

### C. Củng cố GramJS `zaloCallerService`

- Bổ sung disconnect cleanup trong khối `catch` của `zaloCallerService.onModuleInit()` để dọn dẹp kết nối khi session bị duplicate hoặc lỗi.

---

## 3. Danh Sách Tệp Thay Đổi (Proposed Changes)

### Backend API (`apps/api`)

#### [NEW] [zalo-launcher.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-launcher.service.ts)

- Quản lý khởi động và giám sát polling zalo bot an toàn, tự động retry khi gặp 409 Conflict hoặc lỗi mạng, ngăn ngừa crash process.

#### [NEW] [zalo-launcher.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-launcher.service.spec.ts)

- Unit tests kiểm tra khả năng bắt lỗi 409 Conflict và lập lịch retry mà không gây crash.

#### [MODIFY] [zalo.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.module.ts)

- Đặt `launchOptions: false` cho `zalografModule.forRootAsync`.
- Khai báo `zaloLauncherService` trong danh sách `providers`.

#### [MODIFY] [main.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/main.ts)

- Đăng ký `process.on('unhandledRejection')` và `process.on('uncaughtException')` với Logger có cấu trúc.

#### [MODIFY] [zalo-caller.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reminders/zalo-caller.service.ts)

- Bổ sung cleanup `client.disconnect()` an toàn khi `client.connect()` ném lỗi `AUTH_KEY_DUPLICATED`.

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

### Automated Tests

- Chạy unit tests: `npm --prefix apps/api test` (hoặc `node --test` cho các file spec tương ứng).
- Chạy kiểm tra lint & typecheck toàn dự án: `npm run typecheck` & `npm run lint`.

### Manual Verification

- Khởi động backend và kiểm tra khi có 409 Conflict hoặc lỗi GramJS, Web server (port 3000) và Next.js web proxy vẫn hoạt động bình thường, không bị văng crash (`ECONNREFUSED`).
