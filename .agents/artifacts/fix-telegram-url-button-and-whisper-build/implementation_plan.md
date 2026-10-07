# Kế hoạch khắc phục lỗi zalo Bot URL Button & Sửa lỗi Whisper Docker Build

## Bối cảnh & Mục tiêu

Khi biến môi trường `SERVICE_URL_zaloBOT` bị để trống hoặc đặt là `http://localhost:3000`, zalo Bot API từ chối gửi tin nhắn chứa nút bấm URL localhost (`400: Bad Request: BUTTON_URL_INVALID`). Khối xử lý lỗi của hàm gửi tin nhắn tiếp tục gửi lại nút bấm lỗi dẫn đến việc các lệnh `/start`, `/help`, `/dashboard` bị treo im lặng hoàn toàn. Đồng thời, Dockerfile đang build `whisper-server` dưới dạng dynamic shared library nhưng thiếu các file `.so` khi copy sang container runner khiến Whisper Server bị lỗi relocate symbol.

Kế hoạch này xử lý triệt để cả 2 vấn đề trên trong mã nguồn.

---

## Các thay đổi đề xuất

### 1. Module zalo API

#### [MODIFY] [`apps/api/src/zalo/zalo.update.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.update.ts)

- Bổ sung kiểm tra hợp lệ trong `getReportsUrl()`: Nếu `appUrl` là `localhost`, `127.0.0.1` hoặc không phải URL hợp lệ, trả về chuỗi rỗng `''` thay vì cố tạo URL nút bấm sai chuẩn zalo.
- Trong `onDashboard()`: Thông báo rõ ràng cho người dùng nếu chưa cấu hình domain public thay vì gọi tạo nút URL không hợp lệ.

#### [MODIFY] [`apps/api/src/zalo/services/zalo-ui.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)

- Nâng cấp cơ chế fallback 2 tầng trong `sendSafeReply()`:
  - Tầng 1: Gửi tin nhắn Markdown kèm markup.
  - Tầng 2: Nếu lỗi, thử gửi Markdown plain text kèm markup.
  - Tầng 3 (Defensive Guard): Nếu markup chứa nút hỏng gây lỗi zalo (như `BUTTON_URL_INVALID`), tự động tước bỏ toàn bộ custom keyboard và gửi lại nội dung text thuần để đảm bảo người dùng **luôn nhận được phản hồi**.

---

### 2. Docker & Whisper Engine

#### [MODIFY] [`apps/api/Dockerfile`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/Dockerfile)

- Thêm cờ `-DBUILD_SHARED_LIBS=OFF` vào bước cấu hình CMake của `whisper.cpp` trong stage `whisper-builder`.
- Việc build static binary giúp `whisper-server` đóng gói trọn vẹn toàn bộ symbol và hàm C++, khắc phục triệt để lỗi `Error relocating /usr/local/bin/whisper-server: whisper_lang_max_id: symbol not found`.

---

### 3. Kiểm thử & Regression Test

#### [MODIFY] [`apps/api/scripts/check-zalo-command-fallback.cjs`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/scripts/check-zalo-command-fallback.cjs)

- Bổ sung test case kiểm tra hành vi của `onStart`, `onHelp`, `onDashboard` khi `appUrl` là `http://localhost:3000` (xác nhận bot bỏ qua nút localhost và vẫn phản hồi bình thường).

---

## Kế hoạch kiểm tra & xác nhận (Verification Plan)

### Automated Tests

- Chạy script kiểm thử hồi quy:
  ```bash
  node apps/api/scripts/check-zalo-command-fallback.cjs
  ```
- Kiểm tra toàn bộ typecheck và linter:
  ```bash
  npm run typecheck
  npm run lint
  npm run build:api
  ```

### Manual Verification

- Xác nhận các lệnh `/start`, `/help` phản hồi đầy đủ danh sách chức năng khi chạy local cũng như khi chạy trên production.
