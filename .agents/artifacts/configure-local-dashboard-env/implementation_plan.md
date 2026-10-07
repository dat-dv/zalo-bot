# Kế hoạch cấu hình môi trường Dashboard local

RequestFeedback: true

## Mục tiêu

Đảm bảo dịch vụ Docker nhận public origin `https://zalobot.datintech.site` từ file môi trường local, để API không fallback về `http://localhost:3000` khi tạo link Dashboard.

## Phạm vi

- Sửa duy nhất file `.env` tại root.
- Giữ nguyên mọi secret và cấu hình bot/database hiện có.
- Không sửa mã nguồn hay thay đổi kiến trúc.

## Thay đổi dự kiến

1. Xác nhận/giữ `SERVICE_URL_zaloBOT=https://zalobot.datintech.site`.
2. Xác nhận/giữ `NEXT_PUBLIC_API_URL=https://zalobot.datintech.site` để web build cùng public origin.
3. Không thêm `WEB_ORIGIN` vì Web và API dùng chung domain.
4. Sau khi cập nhật, chạy Compose với `ENV_FILE=.env` để container thực sự nạp file này; đây là bắt buộc vì Compose mặc định tham chiếu `.env.local`.

## Xác minh sau khi thực hiện

1. API log hiển thị callback `https://zalobot.datintech.site/oauth2callback`.
2. `curl -I http://localhost:3001` trả phản hồi từ Web/Nginx.
3. `/dashboard` trả nút mở Dashboard thay vì cảnh báo localhost/domain.

## Rủi ro và hoàn tác

Rủi ro thấp, giới hạn ở cấu hình môi trường. Có thể hoàn tác bằng cách khôi phục hai giá trị URL trước đó và recreate container.
