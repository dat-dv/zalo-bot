---
RequestFeedback: true
Task: dashboard-from-zalo
Risk: high
Status: awaiting-approval
---

# Kế hoạch dashboard mở từ zalo bot

## Mục tiêu

Thay trang HTML báo cáo tài chính hiện tại bằng dashboard React, mở an toàn từ nút zalo, để mỗi người dùng xem dữ liệu cá nhân của mình trên web.

## Hiện trạng

- Bot đã có nút **Xem báo cáo**. Nút tạo URL có chữ ký HMAC, `GET /reports/access` đặt cookie `HttpOnly` một ngày rồi chuyển tới `/reports`.
- `GET /reports` hiện trả HTML ghép chuỗi trực tiếp, chỉ có thu/chi tháng, công nợ và 20 giao dịch gần nhất.
- Dữ liệu sẵn có để đưa lên dashboard gồm: tài chính/công nợ, lịch Google, Google Tasks, nhắc nhở và audit log. Danh sách user chỉ phù hợp cho admin.
- React/Vite đã có `apps/web`, nhưng chưa có API client hoặc cơ chế session dashboard.

## Phạm vi đề xuất

1. **Luồng mở từ bot**: giữ URL ký HMAC hiện có, đổi redirect sau khi xác thực sang web dashboard; cookie vẫn `HttpOnly`, không đưa token vào JavaScript hoặc URL sau redirect.
2. **API dashboard bảo vệ bằng cookie**: tạo endpoint JSON chỉ trả dữ liệu của đúng `userId` trong cookie:
   - Tổng quan tài chính tháng: thu, chi, số dư, công nợ cần thu/cần trả.
   - Giao dịch gần đây và công nợ đang mở.
   - Lịch 7 ngày tới, tasks chưa hoàn thành, reminders sắp tới.
   - Hoạt động gần đây từ audit log.
3. **Giao diện React**: trang `/reports` theo kiểu dashboard vận hành gọn, responsive, có bốn trạng thái loading/error/empty/success; hiển thị thông điệp rõ khi chưa kết nối Google hoặc chưa có dữ liệu.
4. **Admin-only**: thêm khối thông tin người dùng/tình trạng kết nối Google khi người mở dashboard là admin. Không trả dữ liệu của người dùng khác cho member.
5. **Contracts & docs**: khai báo API response/route constants trong `@zalobot/contracts`; cập nhật hướng dẫn cấu hình `VITE_API_URL`, CORS/cookie và tài liệu kiến trúc.

## Quyết định kỹ thuật

- Vite chạy riêng ở dev, nên API cần CORS theo allowlist `WEB_ORIGIN` và cookie request dùng `credentials: 'include'`.
- Production nên phục vụ static build của `apps/web` sau reverse proxy cùng HTTPS domain với API để cookie `Secure`/`SameSite=Strict` hoạt động ổn định. Kế hoạch sẽ không tự chọn nhà cung cấp hosting.
- API không dùng `userId` từ frontend; danh tính luôn lấy từ cookie đã được endpoint access xác thực.

## Rủi ro và giảm thiểu

- Cookie cross-origin không hoạt động nếu frontend/API khác domain: cấu hình rõ `WEB_ORIGIN`, `credentials` và HTTPS; khuyến nghị cùng domain trong production.
- Google API có thể chưa kết nối: dữ liệu Google trả trạng thái trống thay vì lỗi toàn trang.
- Dashboard tập hợp nhiều dữ liệu cá nhân: API giới hạn theo session user, admin aggregate là phạm vi riêng và không trả mặc định.

## Xác nhận cần từ anh

Mặc định mình sẽ triển khai toàn bộ các mục trên: **tài chính, công nợ, lịch, tasks, reminders, hoạt động gần đây**, và **khối users chỉ cho admin**. Nếu anh muốn thêm/chỉ giữ một nhóm dữ liệu, hoặc dashboard cần số liệu tổng hợp toàn bộ user cho admin, hãy nói rõ trước khi duyệt.
