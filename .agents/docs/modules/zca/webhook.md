# Webhook API gửi tin nhắn Zalo

> Tài liệu kỹ thuật tiếng Anh (Canonical Knowledge): [`webhook.md`](../../../knowledge/modules/zca/webhook.md)

## Mục đích

Cho hệ thống bên ngoài (app khác, script, công cụ tự động) gọi vào bot để bot dùng tài khoản Zalo cá nhân (ZCA) nhắn tin tới một người hoặc một nhóm.

Vì tin được gửi bằng chính tài khoản Zalo của bot, nếu bị lạm dụng (spam), Zalo có thể khoá tài khoản. Do đó webhook được thiết kế "mặc định đóng": không cấu hình khoá thì không ai gọi được, và có giới hạn số lần gọi.

## Thông tin Endpoint

- **URL**: `POST /api/webhooks/send` (chỉ một đường dẫn, không có alias).
- **Route contract**: `API_ROUTES.webhookSendMessage`; kiểu dữ liệu `IWebhookSendMessageRequest` / `IWebhookSendMessageResponse` (`@zalobot/contracts`).
- **Code**: `apps/api/src/zca/webhook/`.

## Bật webhook và xác thực

1. Tạo khoá ngẫu nhiên dài ít nhất 32 ký tự, ví dụ `openssl rand -hex 32`.
2. Đặt vào `WEBHOOK_API_KEY` trong `.env` rồi restart api. Khoá ngắn hơn 32 ký tự thì api báo lỗi và không khởi động.
3. Bên gọi gửi header `x-api-key: <KHOÁ>` hoặc `Authorization: Bearer <KHOÁ>`.

- Để trống `WEBHOOK_API_KEY` = **tắt webhook**: mọi lời gọi nhận `404`, như thể endpoint không tồn tại. Lúc khởi động api ghi một dòng log báo webhook đang tắt.
- Sai hoặc thiếu khoá: `401`. Khoá được so sánh trong thời gian cố định để không đoán được qua thời gian phản hồi.
- Mọi bên gọi dùng chung một khoá. Đổi khoá = sửa env và restart; khoá cũ hết hiệu lực ngay.

## Định dạng Payload (JSON Body)

```json
{
  "targetId": "123456789012345678",
  "message": "Xin chào! Đây là thông báo tự động từ hệ thống.",
  "threadType": "user"
}
```

- `targetId` (*chuỗi, bắt buộc*): ID người nhận hoặc ID nhóm Zalo, không để trống, tối đa 64 ký tự.
- `message` (*chuỗi, bắt buộc*): nội dung tin, phải có chữ (không chỉ khoảng trắng), tối đa **5000 ký tự**. Tin dài hơn 1900 ký tự được tách thành nhiều tin (tối đa khoảng 3 tin).
- `threadType` (*tuỳ chọn, `'user'` hoặc `'group'`*): bỏ trống thì bot tự nhận diện từ danh bạ và cấu hình kênh; không nhận diện được thì coi là chat riêng. Gửi vào nhóm nên truyền `group` cho chắc.

## Giới hạn số lần gọi

- Tối đa **30 lần gọi mỗi phút** cho toàn bộ webhook (cộng chung mọi bên gọi). Vượt thì nhận `429` và tin không được gửi.
- Chỉ đếm các lời gọi đúng khoá, nên người đoán khoá không làm hết lượt của bên gọi thật.
- Bộ đếm lưu trong Redis; Redis lỗi thì đếm tạm trong tiến trình api.

## Trí nhớ hội thoại

Tin gửi qua webhook vào một kênh đang listen được lưu là thông báo hệ thống (`system`), không được nạp vào trí nhớ dài hạn, nên bot không "học" nội dung thông báo từ hệ thống ngoài.

## Kết quả trả về

### Thành công (`200 OK`)
```json
{
  "success": true,
  "data": {
    "targetId": "123456789012345678",
    "msgId": "987654321",
    "cliMsgId": "123456"
  }
}
```
Chỉ trả 200 khi Zalo thực sự trả về `msgId`.

### Mã lỗi
- `400`: thiếu, rỗng hoặc quá dài `targetId`/`message`, hoặc `threadType` sai.
- `401`: sai hoặc thiếu khoá.
- `404`: webhook đang tắt (chưa đặt `WEBHOOK_API_KEY`).
- `429`: vượt 30 lần/phút.
- `502`: gửi qua Zalo thất bại (sai `targetId`, người nhận chặn, chưa kết bạn...) hoặc không có tin nào được gửi.
- `503`: bot Zalo (ZCA) chưa đăng nhập; vào trang Zalo & Người dùng để quét QR.

## Ví dụ gọi bằng cURL

```bash
curl -X POST https://your-bot-domain.com/api/webhooks/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WEBHOOK_API_KEY" \
  -d '{
    "targetId": "123456789012345678",
    "message": "Thông báo: Đơn hàng #12345 đã được xử lý thành công!"
  }'
```

## Xử lý sự cố

- Nhận `404` dù URL đúng: kiểm tra `WEBHOOK_API_KEY` đã đặt và api đã restart.
- Nhận `502` khi gửi chat riêng: tài khoản bot thường chỉ nhắn được cho người đã kết bạn; thử `threadType` đúng loại.
