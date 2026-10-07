---
RequestFeedback: true
---

# Kế hoạch: thay biến URL public để tương thích Coolify

## Mục tiêu

Ngừng dùng `SERVICE_URL_zaloBOT` vì Coolify dành tiền tố `SERVICE_URL_*` cho biến URL được quản lý. Dùng `APP_URL` làm URL public của API/bot; giữ `NEXT_PUBLIC_API_URL` chỉ cho bundle Dashboard khi build.

## Phạm vi và thay đổi dự kiến

1. Cập nhật `apps/api/src/config/configuration.ts` để `appUrl` chỉ đọc `APP_URL` (rồi mới fallback localhost), và để `WEB_ORIGIN` fallback về `APP_URL`. Việc này loại bỏ hoàn toàn ảnh hưởng của biến magic `SERVICE_URL_zaloBOT` vào link zalo, OAuth và redirect Dashboard.
2. Cập nhật thông báo `/dashboard` trong `apps/api/src/zalo/zalo.update.ts` để hướng dẫn đúng biến `APP_URL`.
3. Cập nhật `.env.example`, `README.md`, `docs/deployment.md`, `.agents/knowledge/global/monorepo-architecture.md` và `.agents/docs/global/monorepo-architecture.md`:
   - `APP_URL=https://zalobot.datintech.site` dùng tại runtime API/bot;
   - `WEB_ORIGIN` là tùy chọn, chỉ cần khi Dashboard khác origin;
   - `NEXT_PUBLIC_API_URL=https://zalobot.datintech.site` là build variable của Dashboard;
   - không khai báo `SERVICE_URL_zaloBOT`.
4. Bổ sung hoặc điều chỉnh kiểm thử phù hợp cho trường hợp URL `localhost` và thông báo cấu hình Dashboard, nếu bộ kiểm thử hiện có có seam tương ứng.

## Không thay đổi

- Không đổi domain đang dùng (`https://zalobot.datintech.site`).
- Không đưa bất kỳ secret hay file `.env` thật vào Git.
- Không thay đổi API Dashboard, schema database, hay cơ chế token.

## Xác minh sau khi thực hiện

1. Chạy kiểm tra TypeScript/lint và test API liên quan.
2. Xác nhận `.env.example` và tài liệu không còn tham chiếu `SERVICE_URL_zaloBOT` như biến ứng dụng.
3. Trên Coolify: đặt `APP_URL`, `WEB_ORIGIN` (nếu cần) là Runtime Variables; đặt `NEXT_PUBLIC_API_URL` là Build Variable, rồi redeploy.
4. Gõ `/dashboard` và xác nhận bot trả nút mở `https://zalobot.datintech.site/api/access?...`.

## Rủi ro và khôi phục

- Những deployment cũ chỉ có `SERVICE_URL_zaloBOT` sẽ dùng fallback localhost sau khi cập nhật. Trước deploy phải thêm `APP_URL` trong Coolify.
- Có thể khôi phục ngay bằng cách giữ deployment cũ hoặc cấu hình lại `APP_URL` và redeploy.

## Kết quả thực hiện

- Hoàn thành ngày 2026-08-23: backend chỉ đọc `APP_URL`; `WEB_ORIGIN` mặc định theo `APP_URL`; biến `SERVICE_URL_zaloBOT` không còn được ứng dụng sử dụng.
- Đã đồng bộ template env và tài liệu triển khai/kiến trúc.
- Đã chạy `npm run typecheck`, `npm run lint`, `git diff --check`, và một kiểm tra cấu hình cô lập xác nhận `APP_URL` được dùng còn `SERVICE_URL_zaloBOT` bị bỏ qua.
