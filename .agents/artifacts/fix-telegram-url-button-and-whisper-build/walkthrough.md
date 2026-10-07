# Tổng kết khắc phục lỗi zalo Bot URL Button & Sửa lỗi Whisper Docker Build

## 1. Các thay đổi đã thực hiện

### 1. Xử lý triệt để lỗi zalo Bot Button URL (`BUTTON_URL_INVALID`)

- **`apps/api/src/zalo/zalo.update.ts`**:
  - Cập nhật `getReportsUrl()` để tự động bỏ qua (trả về chuỗi rỗng) nếu `appUrl` là `localhost` hoặc `127.0.0.1`. Điều này ngăn việc đưa URL không hợp lệ vào inline button của zalo.
  - Cập nhật lệnh `/dashboard` để hướng dẫn người dùng thiết lập `SERVICE_URL_zaloBOT` nếu chưa có domain public.
- **`apps/api/src/zalo/services/zalo-ui.service.ts`**:
  - Nâng cấp `sendSafeReply()` lên cơ chế fallback 3 tầng: nếu zalo API từ chối gửi tin nhắn do nút bấm hoặc markdown không hợp lệ, hệ thống sẽ tự động tước bỏ toàn bộ custom keyboard lỗi và gửi tin nhắn dạng text thuần. Điều này đảm bảo bot **luôn luôn phản hồi** tin nhắn của người dùng trong mọi trường hợp.

### 2. Sửa lỗi biên dịch Docker Whisper Server

- **`apps/api/Dockerfile`**:
  - Thêm cờ `-DBUILD_SHARED_LIBS=OFF` vào câu lệnh CMake trong stage `whisper-builder` để biên dịch `whisper-server` thành file static binary độc lập, khắc phục triệt để lỗi `Error relocating /usr/local/bin/whisper-server: symbol not found`.

### 3. Kiểm thử & Regression Test

- **`apps/api/scripts/check-zalo-command-fallback.cjs`**:
  - Bổ sung các test case:
    1. Lỗi tạo token database -> bỏ qua nút dashboard, vẫn gửi tin nhắn.
    2. URL là localhost -> bỏ qua nút dashboard, vẫn gửi tin nhắn.
    3. URL public hợp lệ -> chèn nút dashboard.
    4. Giả lập zalo API trả về lỗi `BUTTON_URL_INVALID` -> `sendSafeReply` tự động fallback qua 3 tầng để chuyển phát tin nhắn thành công.

---

## 2. Kết quả kiểm tra xác thực (Verification Results)

- **Regression Test**:
  ```bash
  node apps/api/scripts/check-zalo-command-fallback.cjs
  # Output: zalo command fallback & URL resilience checks passed successfully.
  ```
- **Typecheck & Lint**:
  - `npm run typecheck` (Pass 100%)
  - `npm run lint` (Pass 100%)
  - `npm run build:api` (Pass 100%)
