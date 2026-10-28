# Webhook API gửi tin nhắn Zalo

> Tài liệu kỹ thuật tiếng Anh (Canonical Knowledge): [`webhook.md`](../../../knowledge/modules/zca/webhook.md)

## Mục đích

Cho hệ thống bên ngoài (app khác, script, công cụ tự động) gọi vào bot để bot dùng tài khoản Zalo cá nhân (ZCA) nhắn tin. Bot chỉ cho bên ngoài **thấy và nhắn tới** những người nhận admin đã chọn ở **Cài đặt → Webhook**; phần còn lại của danh bạ bot không lộ ra ngoài.

Vì tin được gửi bằng chính tài khoản Zalo của bot, nếu bị lạm dụng (spam), Zalo có thể khoá tài khoản. Do đó webhook được thiết kế "mặc định đóng": không cấu hình khoá thì không ai gọi được, chỉ gửi tới người nhận đã chọn, và có giới hạn số lần gọi.

## Thông tin Endpoint

- **Gửi tin**: `POST /api/webhooks/send`.
- **Lấy danh sách người nhận**: `GET /api/webhooks/targets`.
- **Cấu hình người nhận** (dashboard, chỉ admin): `GET` / `PUT /api/webhooks/recipients`.
- **Route contract**: `API_ROUTES.webhookSendMessage`, `API_ROUTES.webhookTargets`, `API_ROUTES.webhookRecipients`; kiểu dữ liệu `IWebhookSendMessageRequest/Response`, `IWebhookSendResult`, `IWebhookTarget`, `IWebhookTargetsResponse`, `IWebhookRecipient`, `IUpdateWebhookRecipientsRequest` (`@zalobot/contracts`).
- **Code**: `apps/api/src/zca/webhook/`.

## Bật webhook và xác thực

1. Tạo khoá ngẫu nhiên dài ít nhất 32 ký tự, ví dụ `openssl rand -hex 32`.
2. Đặt vào `WEBHOOK_API_KEY` trong `.env` rồi restart api. Khoá ngắn hơn 32 ký tự thì api báo lỗi và không khởi động.
3. Bên gọi gửi header `x-api-key: <KHOÁ>` hoặc `Authorization: Bearer <KHOÁ>`.

- Để trống `WEBHOOK_API_KEY` = **tắt webhook**: mọi lời gọi nhận `404`, như thể endpoint không tồn tại. Lúc khởi động api ghi một dòng log báo webhook đang tắt.
- Sai hoặc thiếu khoá: `401`. Khoá được so sánh trong thời gian cố định để không đoán được qua thời gian phản hồi.
- Mọi bên gọi dùng chung một khoá. Đổi khoá = sửa env và restart; khoá cũ hết hiệu lực ngay.

## Chọn người nhận (Cài đặt → Webhook)

- Admin vào **Cài đặt**, tab **Webhook**: tick người hoặc nhóm Zalo (lấy từ danh bạ bot), bấm **Lưu**. Tối đa 50 người nhận.
- Danh sách lưu ở bảng `webhook_recipients`. API cho dashboard (cần đăng nhập admin, không dùng khoá webhook): `GET /api/webhooks/recipients` và `PUT /api/webhooks/recipients` (`{ "recipients": [...] }`, gửi cả danh sách, thay danh sách cũ).
- Người đã chọn mà bot không còn thấy trong danh bạ vẫn nằm trong danh sách, có ghi chú "Không còn trong danh bạ Zalo"; bỏ tick rồi lưu để xoá.
- Cột ID trên màn là `targetId`; bấm vào để sao chép.

## Gửi tin (`POST /api/webhooks/send`)

```json
{
  "message": "Xin chào! Đây là thông báo tự động từ hệ thống.",
  "targetId": "123456789012345678"
}
```

- `message` (*chuỗi, bắt buộc*): nội dung tin, phải có chữ (không chỉ khoảng trắng), tối đa **5000 ký tự**. Tin dài hơn 1900 ký tự được tách thành nhiều tin (tối đa khoảng 3 tin).
- `targetId` (*chuỗi, tuỳ chọn*): **bỏ trống** thì gửi tới **tất cả** người nhận đã chọn; **có truyền** thì chỉ gửi cho người đó và người đó phải nằm trong danh sách, nếu không nhận `403`. Không để rỗng, tối đa 64 ký tự.
- Không còn trường `threadType`: loại chat (riêng/nhóm) lấy theo người nhận đã lưu. Bên cũ lỡ gửi `threadType` vẫn chạy, trường thừa bị bỏ qua.
- Gửi nhiều người thì bot gửi lần lượt từng người; một người lỗi không chặn những người còn lại.

## Lấy danh sách người nhận (`GET /api/webhooks/targets`)

Website bên tích hợp gọi API này để hiển thị (avatar + tên) cho người dùng của họ chọn đúng người, rồi lưu `id` làm `targetId`. API **chỉ trả người nhận đã chọn** ở Cài đặt → Webhook, không trả cả danh bạ bot.

- Cùng khoá `WEBHOOK_API_KEY`.
- Lọc tuỳ chọn: `?type=user|group`, `?q=` tìm theo tên không phân biệt hoa thường và dấu ("ke toan" ra "Kế toán").
- Mỗi dòng: `id` (dùng làm `targetId`), `name`, `type`, `avatar` (link ảnh hoặc `null`), `totalMembers` (chỉ nhóm). Nhóm đứng trước, rồi theo tên.
- Tên, avatar, số thành viên lấy từ danh bạ đã lưu sẵn của bot, không bắt bot gọi lại Zalo; `fetchedAt` cho biết lần cuối lấy danh bạ. Người nhận không còn trong danh bạ vẫn hiện với tên đã lưu, `avatar` là `null`.
- **Không** trả số điện thoại, biệt danh admin đặt, trạng thái listen.
- Link avatar do Zalo cấp có thể đổi; bên kia nên lưu `targetId`, không lưu link ảnh.

## Giới hạn số lần gọi

- Gửi tin: tối đa **30 lần/phút** (tính theo lần gọi, không theo số người nhận); lấy danh sách: tối đa **10 lần/phút**. Hai bộ đếm riêng, cộng chung mọi bên gọi. Vượt thì nhận `429` và không có gì được gửi.
- Chỉ đếm các lời gọi đúng khoá, nên người đoán khoá không làm hết lượt của bên gọi thật.
- Bộ đếm lưu trong Redis; Redis lỗi thì đếm tạm trong tiến trình api.

## Trí nhớ hội thoại

Tin gửi qua webhook vào một kênh đang listen được lưu là thông báo hệ thống (`system`), không được nạp vào trí nhớ dài hạn, nên bot không "học" nội dung thông báo từ hệ thống ngoài.

## Kết quả gửi tin

### Thành công (`200 OK`)
```json
{
  "success": true,
  "data": {
    "sent": 1,
    "failed": 1,
    "results": [
      { "targetId": "123456789012345678", "threadType": "group", "success": true, "msgId": "987654321", "cliMsgId": "123456" },
      { "targetId": "222333444", "threadType": "user", "success": false }
    ]
  }
}
```
Trả 200 khi ít nhất một người nhận được tin (Zalo trả `msgId`). Ai lỗi thì xem trong `results`.

### Mã lỗi
- `400`: thiếu `message`, hoặc `targetId`/`message` rỗng hay quá dài.
- `401`: sai hoặc thiếu khoá.
- `403`: `targetId` không nằm trong danh sách người nhận.
- `404`: webhook đang tắt (chưa đặt `WEBHOOK_API_KEY`).
- `409`: chưa chọn người nhận nào ở Cài đặt → Webhook.
- `429`: vượt giới hạn số lần gọi.
- `502`: không gửi được cho người nhận nào (người nhận chặn, chưa kết bạn, bot rời nhóm...).
- `503`: bot Zalo (ZCA) chưa đăng nhập; vào trang Zalo & Người dùng để quét QR.

## Ví dụ gọi bằng cURL

```bash
curl -X POST https://your-bot-domain.com/api/webhooks/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: $WEBHOOK_API_KEY" \
  -d '{ "message": "Thông báo: Đơn hàng #12345 đã được xử lý thành công!" }'
```

## Xử lý sự cố

- Nhận `404` dù URL đúng: kiểm tra `WEBHOOK_API_KEY` đã đặt và api đã restart.
- Nhận `409`: chưa lưu người nhận nào; vào Cài đặt → Webhook để chọn.
- Nhận `403`: `targetId` chưa được tick ở Cài đặt → Webhook.
- `GET /targets` trả rỗng: chưa chọn người nhận nào.
- Một người trong `results` bị `success: false` khi gửi chat riêng: tài khoản bot thường chỉ nhắn được cho người đã kết bạn.
