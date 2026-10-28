# Webhook API gửi tin nhắn Zalo

> Tài liệu kỹ thuật tiếng Anh (Canonical Knowledge): [`webhook.md`](../../../knowledge/modules/zca/webhook.md)

## Mục đích

Cho hệ thống bên ngoài (app khác, script, công cụ tự động) gọi vào bot để bot dùng tài khoản Zalo cá nhân (ZCA) nhắn tin tới một người hoặc một nhóm.

Vì tin được gửi bằng chính tài khoản Zalo của bot, nếu bị lạm dụng (spam), Zalo có thể khoá tài khoản. Do đó webhook được thiết kế "mặc định đóng": không cấu hình khoá thì không ai gọi được, và có giới hạn số lần gọi.

## Thông tin Endpoint

- **Gửi tin**: `POST /api/webhooks/send`.
- **Lấy danh sách người nhận**: `GET /api/webhooks/targets` (xem mục bên dưới).
- **Kiểm tra trạng thái bot**: `GET /api/webhooks/status`.
- **Route contract**: `API_ROUTES.webhookSendMessage`, `API_ROUTES.webhookTargets`; kiểu dữ liệu `IWebhookSendMessageRequest/Response`, `IWebhookTarget`, `IWebhookTargetsResponse` (`@zalobot/contracts`).
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

## Lấy danh sách người nhận (`GET /api/webhooks/targets`)

Người nhận do **website bên tích hợp** chọn và lưu, Zalobot không có màn cài đặt người nhận. API này trả bạn bè và nhóm Zalo của tài khoản bot để website bên kia hiển thị (avatar + tên) cho người dùng của họ chọn đúng người, rồi lưu `id` làm `targetId`.

- Cùng khoá `WEBHOOK_API_KEY`.
- Lọc tuỳ chọn: `?type=user|group`, `?q=` tìm theo tên không phân biệt hoa thường và dấu ("ke toan" ra "Kế toán").
- Mỗi dòng: `id` (dùng làm `targetId`), `name`, `type` (dùng làm `threadType`), `avatar` (link ảnh hoặc `null`), `totalMembers` (chỉ nhóm). Nhóm đứng trước, rồi theo tên.
- **Không** trả số điện thoại, biệt danh admin đặt, trạng thái listen.
- Dữ liệu lấy từ danh bạ đã lưu sẵn, không bắt bot gọi lại Zalo; `fetchedAt` cho biết lần cuối lấy danh bạ. Muốn danh bạ mới ngay, admin bấm làm mới ở trang Zalo & Người dùng.
- Nhóm bot đã rời (chỉ còn trong cấu hình) không xuất hiện.
- Link avatar do Zalo cấp có thể đổi; bên kia nên lưu `targetId`, không lưu link ảnh.

## Kiểm tra trạng thái bot (`GET /api/webhooks/status`)

Cho bên tích hợp biết bot có gửi được ngay không và còn bao nhiêu lượt gọi, để họ hiện "Zalo đang mất kết nối" hoặc tạm dừng hàng đợi gửi, thay vì gửi rồi mới nhận `503`/`429`.

- Cùng khoá `WEBHOOK_API_KEY`. Khoá đúng thì **luôn trả `200`**, kể cả lúc bot mất đăng nhập; trạng thái nằm trong body.
- `ready`: gửi được ngay hay không (hiện bằng `zaloLoggedIn`; tách riêng để sau này thêm điều kiện mà bên kia không phải sửa code). Bên kia chỉ cần đọc trường này.
- `zaloLoggedIn`, `directoryFetchedAt` (lần cuối cập nhật danh bạ), `limits.send` / `limits.targets` gồm `limit`, `remaining`, `windowSeconds`, và `checkedAt`.
- Đọc số lượt còn lại không làm mất lượt; số này tính chung mọi bên gọi.
- Không trả ID/tên tài khoản Zalo của bot, số kênh listen, trạng thái QR hay proxy: những thứ đó chỉ có ở trang admin.
- Khi bot mất đăng nhập: admin vào trang Zalo & Người dùng quét lại QR; `ready` tự về `true`.

## Chặn spam theo IP (trước bước kiểm tra key)

Giới hạn theo route bên dưới chỉ đếm request **đúng key**. Để người không có key không spam được (làm ngập api, dò key), mọi request webhook đi qua thêm một lớp chặn theo IP, chạy **trước** khi kiểm tra key:

- **120 request/phút mỗi IP**, đúng hay sai key đều đếm. Vượt thì `429` ngay.
- **Sai key 10 lần trong 15 phút** thì lần thứ 11 khoá IP đó **15 phút**: mọi request từ IP đó nhận `429`, kể cả khi gửi đúng key. Webhook đang tắt (404) thì không tính là sai key.
- Log chỉ ghi một lần khi IP bị khoá hoặc lần đầu chạm giới hạn trong phút, không ghi từng request.
- IP lấy từ `cf-connecting-ip` (Cloudflare), rồi `x-real-ip` (nginx), cùng cách với đăng nhập bằng mã cố định (`getClientIp`).

**Giới hạn cần biết:** header IP giả được nếu ai đó gọi thẳng vào server không qua Cloudflare; họ né được giới hạn theo IP nhưng vẫn không dò được khoá 64 ký tự. Không có giới hạn chung mọi IP cho sai key, vì kẻ xấu sẽ dùng nó để chặn luôn bên tích hợp thật. Nên bật thêm Rate Limiting Rule của Cloudflare cho `/api/webhooks/*` và chỉ cho server nhận traffic từ Cloudflare.

**Xử lý sự cố:** bên tích hợp báo bị `429` "Địa chỉ IP này gửi sai API key quá nhiều lần" thì họ đã dùng sai khoá; sửa khoá rồi đợi 15 phút (hoặc xoá key Redis `webhook:ip:<ip>:locked`).

## Giới hạn số lần gọi

- Gửi tin: tối đa **30 lần/phút**; lấy danh sách: **10 lần/phút**; kiểm tra trạng thái: **60 lần/phút**. Ba bộ đếm riêng, cộng chung mọi bên gọi. Vượt thì nhận `429` và không có gì được gửi.
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
