---
RequestFeedback: true
Task: single-origin-env
Risk: medium
Status: awaiting-approval
---

# Kế hoạch gom cấu hình domain về một biến

## Mục tiêu

Dùng duy nhất `SERVICE_URL_zaloBOT=https://zalobot.datintech.site` làm public origin cho API, React dashboard và link zalo khi hai ứng dụng được serve chung một domain/container.

## Thay đổi đề xuất

1. API đọc `SERVICE_URL_zaloBOT` làm `appUrl` và `webOrigin`; giữ `APP_URL`/`WEB_ORIGIN` làm fallback tạm thời để không làm hỏng deployment cũ.
2. React bỏ yêu cầu `VITE_API_URL` cho mô hình same-origin; Axios mặc định dùng `window.location.origin` khi không được cấp biến này.
3. Rút gọn root `.env`: giữ `SERVICE_URL_zaloBOT`, bỏ các key trùng (`APP_URL`, `WEB_ORIGIN`, `VITE_API_URL`) nếu đang tồn tại; không in hoặc thay các secret.
4. Cập nhật `.env.example`, README và agent docs: mô tả rõ `SERVICE_URL_zaloBOT` là nguồn cấu hình domain duy nhất.
5. Với tunnel local, cấu hình Vite proxy các route dashboard tới `localhost:3000`; không yêu cầu browser biết Docker network.
6. Giữ `SERVICE_FQDN_zaloBOT` nguyên trạng nếu Coolify tự inject/quản lý nó, nhưng code không phụ thuộc vào key này.

## Điều kiện triển khai

- Container chung phải thực sự serve React ở `/reports` và route API Nest (`/reports/access`, `/reports/dashboard`, `/reports/refresh`).
- HTTPS bắt buộc ở production để refresh cookie được đặt với thuộc tính `Secure`.

## Kiểm tra

- Build/typecheck/lint toàn workspace.
- Xác nhận `.env` chỉ còn một public-origin key do ứng dụng dùng: `SERVICE_URL_zaloBOT`.
