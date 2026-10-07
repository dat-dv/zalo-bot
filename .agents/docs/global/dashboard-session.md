---
metadata:
  agent-artifact:
    id: docs-global-dashboard-session
    type: documentation
    depends_on:
      - .agents/knowledge/global/dashboard-session.md
---

# Phiên Dashboard và các trang web

Tài liệu này hướng dẫn cơ chế xác thực phiên làm việc của Dashboard từ zalo và cấu trúc các trang web, ánh xạ trực tiếp với tri thức canonical [`dashboard-session.md`](../../knowledge/global/dashboard-session.md).

## Luồng đăng nhập từ zalo

Bot tạo link `/api/access?token=...` với token ngẫu nhiên dùng một lần. Database chỉ lưu hash SHA-256 của token. Khi mở link, API xác minh token chưa dùng và chưa hết hạn, đánh dấu đã dùng rồi mới cấp phiên dashboard.

Nút **📊 Dashboard** trong menu inline chung của `/start` và `/help` là URL trực tiếp, vì vậy mở Dashboard ngay bằng một lần bấm. Danh mục menu chung cũng là nguồn duy nhất cho command menu zalo và các nút nhanh; các nút được ghép tối đa hai nút mỗi hàng để giảm chiều cao màn hình. Mục quản trị chỉ xuất hiện trong menu của chat Admin. Người dùng cũng có thể dùng `/dashboard` hoặc nhắn `Dashboard`, `mở dashboard`, `xem dashboard`, `cho anh xem dashboard`; các yêu cầu này phải trả link thật, không chuyển sang Gemini để suy đoán. Nếu việc tạo token dashboard lỗi, bot vẫn phải trả lời `/start` và `/help`; chỉ ẩn nút Dashboard trong phản hồi đó. Callback cũ chỉ còn để các menu đã gửi trước khi nâng cấp vẫn trả về một link mới.

- Access token có hiệu lực 1 ngày và được web gửi trong header `Authorization`.
- Refresh token có hiệu lực 7 ngày, được đổi mới sau mỗi lần refresh và chỉ nằm trong HTTP-only cookie.
- Không gửi refresh token qua URL hay response body. Một link zalo đã mở thành công không thể dùng lại.

## Các trang (Nhóm private)

- `/`: Tổng quan, chỉ số tài chính nhanh, việc cần làm, nhắc nhở, lịch và hoạt động gần đây.
- `/transactions`: Thu chi, lịch sử dòng tiền với bộ lọc `[Tất cả] [Thu] [Chi]`.
- `/debts`: Vay & cho vay, công nợ cần thu / cần trả đang mở.
- `/analytics`: Phân tích thu–chi, cơ cấu danh mục và biến động số dư.
- `/calendar`: Lịch trình 7 ngày tới kết nối Google Calendar.
- `/tasks`: Danh sách nhiệm vụ từ Google Tasks.
- `/reminders`: Danh sách lời nhắc tự động.
- `/contacts`: Danh bạ người liên quan của người đang đăng nhập.

Trang Người liên quan gọi `GET /api/contacts`. API tự lấy user từ access token; không nhận `userId` từ client, vì vậy không thể xem danh bạ của người khác.

## Kiểm tra

1. Mở link báo cáo từ bot lần đầu: dashboard hiển thị bình thường.
2. Mở lại đúng link đó: API phải trả 401, không tạo phiên mới.
3. Vào từng page từ navigation; kiểm tra bảng empty/loading và mobile scroll ngang.
4. Chạy `npm run lint`, `npm run typecheck`, `npm run build`.
5. Chạy `node apps/api/scripts/check-zalo-command-fallback.cjs` sau khi build API để xác nhận dashboard lỗi không chặn `/start` và `/help`.
