# Kế hoạch: tắt CORS mở toàn bộ trên production

RequestFeedback: true

## Mục tiêu

Đặt `CORS_ALLOW_ALL=false` trong `.env` production để API chỉ chấp nhận origin đã cấu hình qua `WEB_ORIGIN`.

## Phạm vi thay đổi

| Tệp    | Thay đổi                                                         |
| ------ | ---------------------------------------------------------------- |
| `.env` | Đổi duy nhất `CORS_ALLOW_ALL=true` thành `CORS_ALLOW_ALL=false`. |

## Cơ sở kỹ thuật

`apps/api/src/config/configuration.ts` đọc biến này với mặc định `false`. Khi tắt, `apps/api/src/main.ts` giới hạn CORS theo `WEB_ORIGIN`; `.env` hiện đặt origin này là `https://zalobot.datintech.site`.

## Rủi ro và triển khai

- Dashboard và API cùng domain nên không cần CORS mở toàn bộ.
- Sau khi thay đổi, cần redeploy/restart API để biến runtime mới có hiệu lực.
- Không thay đổi `APP_URL`, `WEB_ORIGIN` hoặc `NEXT_PUBLIC_API_URL`.

## Xác minh sau triển khai

1. Mở Dashboard production và tải dữ liệu thành công.
2. Xác nhận request cùng origin vẫn gửi cookie refresh được.
3. Gọi endpoint API từ một origin không được phép phải không nhận CORS allow-origin phản chiếu.
