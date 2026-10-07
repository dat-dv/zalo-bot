---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch: thêm nút đóng cho từng khoản công nợ

## Chẩn đoán đã xác nhận

Ảnh chụp khớp với `zaloUiService.buildDebtActionsMarkup()`: hàm này hiện chỉ sinh hai hàng nút `💵 Trả nợ` và `🗑️ Xóa khoản này`, không có thao tác đóng. Vì vậy người dùng không thể loại tin nhắn chi tiết công nợ khỏi cuộc trò chuyện.

Đã chạy kiểm tra trực tiếp trên markup của hàm này; kiểm tra đỏ với lỗi `Thiếu nút đóng công nợ` khi yêu cầu nút `❌ Đóng` có callback `debt:close`.

Hệ thống đã có mẫu xử lý phù hợp cho thông báo: callback `notice:close` gọi `ctx.deleteMessage()` và, nếu zalo không cho phép xóa, chỉ gỡ bàn phím inline để thao tác vẫn kết thúc an toàn.

## Phạm vi thực hiện

1. Bổ sung hàng nút `❌ Đóng` với callback dành riêng cho công nợ (`debt:close`) vào `buildDebtActionsMarkup()`.
2. Thêm action handler `debt:close` vào `zalo.update.ts`, xác nhận callback rồi xóa đúng tin nhắn công nợ; nếu không xóa được thì gỡ bàn phím inline như hành vi đóng thông báo hiện có.
3. Bổ sung kiểm thử hồi quy cho markup công nợ, xác nhận đủ ba nút và callback đóng không nhầm với các luồng thông báo khác.
4. Cập nhật quy ước bố cục phản hồi zalo trong knowledge (English) và tài liệu vận hành (Vietnamese), ghi rõ rằng thẻ chi tiết công nợ có thao tác đóng an toàn.

## Tệp dự kiến ảnh hưởng

- `apps/api/src/zalo/services/zalo-ui.service.ts`
- `apps/api/src/zalo/zalo.update.ts`
- `apps/api/src/zalo/services/zalo-ui.service.spec.ts`
- `.agents/knowledge/global/zalo-response-layout.md`
- `.agents/docs/global/zalo-response-layout.md`

## Kiểm thử sau khi triển khai

- Chạy kiểm thử `zaloUiService` để xác nhận các callback `debt:pay:*`, `debt:delete:*`, và `debt:close`.
- Chạy `npm run typecheck` và `npm run lint`.
- Kiểm tra thủ công trong zalo: mở `/debts`, bấm `❌ Đóng`, xác nhận tin nhắn bị xóa hoặc tối thiểu không còn các nút thao tác nếu zalo từ chối xóa.

## Rủi ro và giới hạn

- Không thay đổi dữ liệu, API, hay thao tác trả/xóa nợ.
- Việc xóa tin nhắn phụ thuộc quyền và giới hạn của zalo; phương án dự phòng gỡ keyboard giữ cho nút không bị vô tác dụng.
