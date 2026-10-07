# Bàn giao: chặn zalo long polling theo môi trường

## Đã thay đổi

- Thêm `zalo_LONG_POLLING_ENABLED`, mặc định `true`.
- Khi giá trị là `false`, `nestjs-zalograf` tạo bot client nhưng không gọi `bot.launch()`, nên không có yêu cầu `getUpdates` và không thể phát sinh lỗi 409.
- Luồng gửi tin nhắn từ reminder và Google OAuth vẫn dùng được bot client này.

## Cách dùng

Khi production đang chạy bot, thêm vào `.env.local` trên máy local:

```env
zalo_LONG_POLLING_ENABLED=false
```

Repository hiện dùng `.env` local nên cờ này đã được đặt `false` trong file đó.

Giữ giá trị `true` hoặc không khai báo biến này ở đúng một bot worker.

## Xác minh

- `npm run typecheck`: đạt.
- `npm run lint`: đạt.
- Khởi động thử trong sandbox đi tới phần khởi tạo Nest và không kích hoạt zalograf polling. Sandbox chặn bind cổng HTTP và kết nối GramJS, nên không thể hoàn tất thử nghiệm runtime end-to-end trong môi trường này.
