---
metadata:
  agent-artifact:
    id: docs-global-dashboard-session
    type: documentation
    depends_on:
      - .agents/knowledge/global/dashboard-session.md
      - apps/api/src/reports/reports-token.service.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/zalo/text/strategies/dashboard-tool.strategy.ts
      - apps/web/src/modules/auth/client/auth-storage.ts
      - apps/web/src/shared/api/http-client.ts
---

# Phiên Dashboard và các trang web

Tài liệu này giải thích cơ chế đăng nhập Dashboard từ Zalo và cấu trúc các trang web, ánh xạ với tri thức canonical [`dashboard-session.md`](../../knowledge/global/dashboard-session.md).

## Vì sao dùng link một lần

Người dùng Zalo không có mật khẩu dashboard. Thay vào đó bot cấp một link đăng nhập dùng **một lần**, sống ngắn, gắn với chính tài khoản Zalo đã nhắn. Database chỉ lưu hash SHA-256 của token, nên dù lộ database cũng không dùng lại được link.

## Luồng đăng nhập từ Zalo

1. Người dùng nhắn `/dashboard` hoặc `dashboard`, `mở dashboard`, `xem dashboard`. Đây là lệnh fast-path, không đi qua LLM nên luôn trả link thật.
2. Bot sinh token ngẫu nhiên 32 byte, lưu hash vào bảng `dashboard_exchange_tokens` với hạn **20 phút**, rồi gửi link `<APP_URL>/api/access?token=...`. Khi chạy qua tunnel (trycloudflare, ngrok, loca.lt), bot ưu tiên origin của tunnel để link mở được từ điện thoại.
3. Khi mở link, API đánh dấu token đã dùng trong cùng một câu `UPDATE` có điều kiện (chưa dùng, chưa hết hạn). Link cũ hoặc hết hạn nhận trang lỗi `401` "Liên kết này đã hết hạn hoặc đã được sử dụng".
4. API cấp access token (24 giờ) và refresh token (7 ngày). Refresh token chỉ nằm trong cookie HTTP-only `reports_refresh`, không bao giờ đi qua URL hay body.
5. API chuyển hướng sang `<WEB_ORIGIN>/dashboard#dashboard_token=<access token>`. Nếu request đi qua domain/tunnel thật (không phải localhost), API dùng host đang truy cập thay cho `WEB_ORIGIN` để không bị đá sang domain khác.
6. Nếu tạo token lỗi, bot trả thông báo lỗi cấu hình thay vì link.

## Phía trình duyệt

- Web đọc `dashboard_token` (hoặc `token`) từ hash/query, lưu access token vào `localStorage` key `zalobot.dashboard.access-token` rồi xóa token khỏi URL. Nếu query chứa token không có dấu `.` (token exchange), web tự chuyển sang `/api/access` để đổi lấy phiên.
- Mọi request gửi `Authorization: Bearer ...`. Khi nhận `401`, client gọi `POST /api/refresh` đúng một lần (dùng chung một promise cho các request song song), thử lại request; nếu refresh thất bại thì xóa token.
- `POST /api/logout` xóa cookie refresh.

## Các trang (nhóm private)

- `/` và `/dashboard`: Tổng quan.
- `/transactions`: Thu chi; `/expenses` và `/income` tự chuyển sang `/transactions?type=expense|income`.
- `/debts`: Vay & cho vay.
- `/analytics`: Phân tích thu–chi.
- `/calendar`, `/tasks`, `/reminders`: Lịch Google, việc cần làm Google Tasks, lời nhắc.
- `/contacts`: Người liên quan; `/places`: Nơi chốn.
- `/zca`: Zalo & Người dùng (đăng nhập ZCA, cuộc trò chuyện, quản lý user cho admin).
- `/settings`: Cài đặt, danh mục thu chi.

Trang Người liên quan gọi `GET /api/contacts`; API tự lấy user từ access token (tối đa 200 người), không nhận `userId` từ client.

## Kiểm tra

1. Gửi `/dashboard`, mở link lần đầu: dashboard hiển thị bình thường.
2. Mở lại đúng link đó: phải thấy trang lỗi `401`, không tạo phiên mới.
3. Khi access token hết hạn (sau 24 giờ) nhưng cookie refresh còn: request đầu tiên `401` phải tự refresh và thử lại. Lưu ý client chỉ refresh khi vẫn còn access token trong `localStorage`.
4. Vào từng trang từ navigation; kiểm tra trạng thái loading/empty và cuộn ngang trên mobile.
5. Chạy `npm run lint`, `npm run typecheck`, `npm run build`.
