# Tổng Kết Triển Khai: Xử Lý Triệt Để Lỗi Crash Backend (zalo 409 Conflict & Process Error Guards)

## 1. Mục Tiêu Đã Hoàn Thành

Đã giải quyết triệt để vấn đề backend NestJS API bị dừng đột ngột (crash) khi gặp lỗi zalo polling conflict (`409: Conflict`) hoặc lỗi bất đồng bộ chưa bắt được (unhandled rejections), đảm bảo Web API và Web Proxy frontend luôn duy trì hoạt động liên tục.

---

## 2. Chi Tiết Các Thay Đổi (Changes Made)

### A. Quản lý vòng đời zalo Bot Polling chủ động (`zaloLauncherService`)

- [NEW] `zalo-launcher.service.ts`:
  - Thay thế cơ chế tự động launch không an toàn của `nestjs-zalograf`.
  - Tự động bắt lỗi `zaloError: 409 Conflict` khi có nhiều instance bot chạy song song.
  - Ghi log cảnh báo rõ ràng `⚠️ zalo polling conflict (409 Conflict)...` và tự động lập lịch retry sau 15 giây mà **không làm crash tiến trình NestJS**.
  - Tự động bắt các lỗi mạng (ETIMEDOUT, 502) và retry với backoff.
  - Đảm bảo dừng polling sạch sẽ (`SIGTERM`) khi tắt server.
- [MODIFY] `zalo.module.ts`:
  - Cấu hình `launchOptions: false` trong `zalografModule.forRootAsync`.
  - Khai báo và xuất `zaloLauncherService`.

### B. Bổ sung Global Process Error Resilience Guards

- [MODIFY] `main.ts`:
  - Đăng ký global handlers cho `process.on('unhandledRejection')` và `process.on('uncaughtException')` để ghi log chi tiết thay vì để Node.js terminate runtime.

### C. Dọn Dẹp An Toàn Kết Nối GramJS

- [MODIFY] `zalo-caller.service.ts`:
  - Bổ sung `await this.client.disconnect()` trong khối `catch` khi gặp `406: AUTH_KEY_DUPLICATED` hoặc lỗi khởi tạo, tránh rò rỉ socket/timer ngầm.

### D. Đồng Bộ Tri Thức & Tài Liệu

- [MODIFY] `zalo-command-intake.md` (knowledge)
- [MODIFY] `zalo-command-intake.md` (docs)

---

## 3. Kết Quả Kiểm Thử & Xác Minh (Verification Results)

1. **Unit Tests**:
   - Chạy `npx tsx --test src/zalo/services/zalo-launcher.service.spec.ts` -> **3/3 tests PASSED (100%)**.
1. **Linter & Typecheck**:
   - `npm run lint:check` trong `apps/api` -> **PASSED (0 errors)**.
   - `npm run typecheck` trong `apps/api` -> **PASSED (0 errors)**.
1. **Agent System Validation**:
   - `npm run agent-system:validate` -> **PASSED (81 artifacts, 0 errors)**.
