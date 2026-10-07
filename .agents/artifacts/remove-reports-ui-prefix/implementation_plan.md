# Kế hoạch bỏ tiền tố `/reports` khỏi UI

RequestFeedback: true

## Mục tiêu

Đưa các URL giao diện báo cáo từ nhánh `/reports` về các URL trực tiếp, để người dùng không còn thấy `/reports` trên thanh địa chỉ.

## Phát hiện hiện tại

- Frontend Next.js khai báo các trang UI tại `apps/web/app/reports/**`.
- `APP_ROUTES` đặt trang chính là `/reports` và các trang con như `/reports/statistics`.
- Trang gốc `/` hiện chỉ chuyển hướng sang `/reports`.
- API đã dùng tiền tố riêng `/api/*`; không cần đổi API để thực hiện yêu cầu này.

## Thay đổi dự kiến

1. Chuyển các route UI thành `/`, `/statistics`, `/contacts`, `/debts` và `/expenses`; bỏ redirect từ `/` sang `/reports`.
2. Cập nhật `APP_ROUTES` và mọi điều hướng trong dashboard để sinh URL mới.
3. Cập nhật URL redirect/dashboard link ở backend để sau khi xác thực người dùng được đưa về `/`, không phải `/reports`.
4. Cập nhật tài liệu kiến trúc và hướng dẫn dashboard phản ánh URL UI mới.
5. Chạy lint, typecheck và build cho workspace web; kiểm tra các deep-link UI mới.

## Phạm vi và rủi ro

- Phạm vi: route frontend, hợp đồng điều hướng dùng chung, URL redirect từ API, tài liệu liên quan.
- Rủi ro trung bình: bookmark/link cũ `/reports/*` sẽ không còn là URL chính. Theo yêu cầu “bỏ đi”, kế hoạch này loại bỏ prefix thay vì giữ route cũ làm alias. Nếu cần tương thích link cũ, sẽ bổ sung redirect riêng.

## Tiêu chí hoàn tất

- Mở dashboard tại `/` và mọi navigation không tạo URL chứa `/reports`.
- Các trang con hoạt động với URL trực tiếp.
- Luồng mở dashboard từ zalo/API chuyển về `/`.
- Lint, typecheck và build web thành công.
