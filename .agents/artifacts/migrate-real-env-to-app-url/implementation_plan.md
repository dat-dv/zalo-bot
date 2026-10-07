---
RequestFeedback: true
---

# Kế hoạch: chuyển env thật sang APP_URL

## Hiện trạng đã xác minh (không đọc secret)

- `.env` tồn tại, có `SERVICE_URL_zaloBOT` và `NEXT_PUBLIC_API_URL`, chưa có `APP_URL` hoặc `WEB_ORIGIN`.
- `.env.local` chưa tồn tại.

## Thay đổi sẽ thực hiện

1. Trong `.env`, đổi tên `SERVICE_URL_zaloBOT` thành `APP_URL`, giữ nguyên giá trị domain hiện có; thêm `WEB_ORIGIN` cùng domain đó; giữ nguyên `NEXT_PUBLIC_API_URL` và toàn bộ secret.
2. Tạo `.env.local` từ cấu hình runtime tương đương `.env`, không in hoặc thay đổi giá trị secret; áp dụng cùng tên biến `APP_URL`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`.
3. Kiểm tra cả hai file chỉ theo tên biến và dạng URL; không hiển thị token, secret hoặc nội dung nhạy cảm.

## Rủi ro và khôi phục

- `.env.local` chứa bản sao secret local. File này đã được ignore bởi Git; không được commit hay hiển thị.
- Có thể khôi phục bằng cách đổi `APP_URL` trở lại `SERVICE_URL_zaloBOT` trong từng file nếu cần rollback code cũ.

## Kết quả thực hiện

- Hoàn thành ngày 2026-08-23: `.env` đã chuyển sang `APP_URL` và `WEB_ORIGIN`, giữ nguyên domain và các secret hiện có.
- Đã tạo `.env.local` với ba URL public; các secret khác tiếp tục fallback từ `.env` theo thứ tự nạp cấu hình API.
- Đã kiểm tra cả hai file có `APP_URL`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, không còn `SERVICE_URL_zaloBOT`, và đều được Git ignore.
