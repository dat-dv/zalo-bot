# Kế hoạch rút gọn ENV production

RequestFeedback: true

## Mục tiêu

Loại bỏ các biến môi trường không được source production hiện tại sử dụng hoặc chỉ lặp lại giá trị mặc định, đồng thời giữ nguyên mọi biến cần thiết cho bot, Google OAuth, dashboard và build dashboard tĩnh.

## Phạm vi thay đổi

1. Cập nhật `.env` (không đưa secret vào diff/ghi chú): xoá `SERVICE_FQDN_zaloBOT`, `REPORT_ACCESS_TOKEN`, `GEMINI_MODEL`, `DEFAULT_TIMEZONE`, `zalo_LONG_POLLING_ENABLED`, `PORT`, `WEB_PORT` và `WEB_ORIGIN` khi chúng chỉ có giá trị mặc định hoặc trùng `SERVICE_URL_zaloBOT`.
2. Xoá bộ `zalo_API_ID`, `zalo_API_HASH`, `zalo_SESSION` chỉ khi xác nhận không dùng tính năng CallMe/gọi nhá máy. Đây là nhóm tính năng tuỳ chọn, không xoá mặc định để tránh mất chức năng.
3. Cập nhật `.env.example` thành danh sách tối thiểu: giữ `SERVICE_URL_zaloBOT`, `NEXT_PUBLIC_API_URL`, các secret backend bắt buộc và hai dashboard signing secret; chuyển các biến tuỳ chọn (GramJS, giới hạn Whisper/OCR) thành phần tài liệu riêng thay vì buộc xuất hiện trong template chính.
4. Đồng bộ README, `docs/deployment.md`, `.agents/knowledge/global/monorepo-architecture.md` và `.agents/docs/global/monorepo-architecture.md`: bỏ mô tả `REPORT_ACCESS_TOKEN`, ghi rõ `WEB_ORIGIN` là fallback theo `SERVICE_URL_zaloBOT` khi cùng origin, và nêu `NEXT_PUBLIC_API_URL` phải được truyền lúc Docker build.

## Giữ lại bắt buộc

- `SERVICE_URL_zaloBOT`, `NEXT_PUBLIC_API_URL`
- `zalo_BOT_TOKEN`, `zalo_ADMIN_ID`
- `GEMINI_API_KEY`, `DATA_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`

## Rủi ro và biện pháp bảo vệ

- Không đổi `DATA_ENCRYPTION_KEY`, vì token Google đã lưu trong SQLite sẽ không thể giải mã bằng key mới.
- `NEXT_PUBLIC_API_URL` không được xoá: Docker Compose sẽ mặc định build dashboard với `http://localhost:3000`, gây lỗi gọi API trên trình duyệt.
- Không xoá bộ GramJS nếu CallMe đang được sử dụng; nếu xoá thì hệ thống tự fallback sang zalo text.
- Không thay giá trị secret; các secret đã bị lộ cần được rotate bằng thao tác vận hành riêng.

## Xác minh sau khi thực hiện

1. Kiểm tra danh sách key của `.env` và `.env.example` không còn key dư.
2. Chạy `npm run lint`, `npm run typecheck` và `npm run build`.
3. Dựng lại Docker dashboard, kiểm tra bundle dùng đúng `NEXT_PUBLIC_API_URL` và bot nhận lệnh qua long polling mặc định.

## Ghi nhận trước khi thực hiện

- Validation của agent không chạy được trong sandbox do `tsx` không thể tạo IPC socket; đây là giới hạn môi trường kiểm tra, không phải lỗi cấu hình ứng dụng.
- Tài liệu kiến trúc hiện còn nêu `REPORT_ACCESS_TOKEN` được dùng, nhưng source `apps/api` không còn đọc biến này; tài liệu sẽ được sửa đồng bộ.

## Kết quả triển khai

- Đã xoá các giá trị mặc định/trùng lặp và hai key không được source `apps/api` sử dụng khỏi `.env`: `PORT`, `SERVICE_FQDN_zaloBOT`, `REPORT_ACCESS_TOKEN`, `GEMINI_MODEL`, `DEFAULT_TIMEZONE`, `zalo_LONG_POLLING_ENABLED`, `WEB_ORIGIN`, `WEB_PORT`.
- Đã giữ nguyên `zalo_API_ID`, `zalo_API_HASH` và `zalo_SESSION` vì CallMe đang được sử dụng.
- Đã rút gọn `.env.example`, cập nhật hướng dẫn deploy và đồng bộ tài liệu kiến trúc. Token bot thật từng có trong `docs/deployment.md` đã được thay bằng placeholder.
- Đã kiểm tra danh sách ENV không còn các key dư trên; `npm run lint`, `npm run typecheck` và `npm run build` đều thành công.
