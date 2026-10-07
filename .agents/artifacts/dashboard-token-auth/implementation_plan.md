---
RequestFeedback: true
Task: dashboard-token-auth
Risk: high
Status: awaiting-approval
---

# Kế hoạch xác thực token dashboard từ zalo

## Mục tiêu

Khi user bấm nút dashboard trong zalo, API sẽ xác thực link ký, cấp access token cho React lưu vào `localStorage`, và cấp refresh token qua cookie `HttpOnly`. React dùng Axios interceptor để tự refresh access token khi API trả `401`; TanStack Query quản lý dữ liệu dashboard và trạng thái tải/lỗi.

## Luồng xác thực

```text
zalo button
  -> /reports/access?userId&token (HMAC link hiện có)
  -> xác thực link còn hạn năm phút, cấp:
       access token ngắn hạn (15 phút) trong URL fragment #dashboard_token=...
       refresh token dài hạn (7 ngày) ở HttpOnly/Secure cookie
  -> WEB_ORIGIN/reports
  -> React đọc fragment, lưu access token vào localStorage, rồi xóa fragment khỏi URL
  -> Axios gửi Authorization: Bearer <access token>
  -> 401: interceptor gọi /reports/refresh bằng refresh cookie, thay access token và retry request một lần
```

Fragment không được gửi về server hoặc theo HTTP Referer; refresh token không được đưa vào localStorage hay JavaScript.

## Phạm vi triển khai

1. Tạo token service trong `apps/api/src/reports/` dùng chữ ký HMAC, payload tối thiểu gồm zalo user ID, loại token, hạn dùng và token version/nonce.
2. Đổi `/reports/access` thành exchange với link bot hết hạn sau năm phút: cấp access token 15 phút trong fragment và refresh token 7 ngày ở cookie `HttpOnly`; redirect tới `WEB_ORIGIN/reports`.
3. Bảo vệ `/reports/dashboard` bằng Bearer access token thay vì đọc cookie trực tiếp; thêm `POST /reports/refresh` để xoay refresh token và trả access token mới.
4. Thêm `POST /reports/logout` để xóa refresh cookie và frontend storage.
5. Cập nhật `apps/web`:
   - cài Axios và `@tanstack/react-query`;
   - `auth-storage` chỉ lưu access token;
   - Axios instance có request interceptor, refresh-response interceptor và chống refresh lặp;
   - `QueryClientProvider`, query-key `dashboard`, repository có `AbortSignal`, hook `useDashboardQuery` và mutation refresh;
   - thay gọi `fetch`/`useState` thủ công bằng TanStack Query.
6. Cập nhật `packages/contracts` cho token response và route constants.
7. Cập nhật file root `.env` đang có (không in hoặc thay thế các secret hiện hữu): thêm các key dashboard thiếu, sinh secret ngẫu nhiên mới cho `DASHBOARD_ACCESS_TOKEN_SECRET` và `DASHBOARD_REFRESH_TOKEN_SECRET` nếu chưa tồn tại. Cập nhật `.env.example` bằng placeholder.
8. Cập nhật tài liệu kiến trúc và hướng dẫn vận hành, rồi chạy build/typecheck/lint.

## Bảo mật và giới hạn

- Theo yêu cầu, access token ở `localStorage` để client xác định user. Đây là bề mặt XSS lớn hơn mô hình cookie-only, nên token ngắn hạn, không chứa dữ liệu nhạy cảm và không dùng để refresh.
- Refresh token là `HttpOnly`, `Secure` ở production, `SameSite=Lax`, có xoay vòng khi refresh; browser script không thể đọc nó.
- API không nhận `userId` từ client; identity chỉ từ token đã ký.
- Đăng xuất chỉ xóa client-side storage và refresh cookie; revocation trên mọi thiết bị cần thêm bảng session, không nằm trong phạm vi này.

## Cấu hình dự kiến

```env
WEB_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000
REPORT_ACCESS_TOKEN=<existing secret for zalo link signing>
DASHBOARD_ACCESS_TOKEN_SECRET=<new 64-char random secret>
DASHBOARD_REFRESH_TOKEN_SECRET=<new 64-char random secret>
```

## Tiêu chí hoàn thành

- User zalo bấm dashboard, được redirect vào React và tự có access token.
- Refresh hoạt động khi access token hết hạn, không yêu cầu mở lại bot trong 7 ngày.
- Axios retry đúng một lần sau refresh; TanStack Query hiển thị loading/error/empty/success.
- Không có refresh token nào xuất hiện trong URL, localStorage hoặc API response.
