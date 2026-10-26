# Chẩn đoán: thẻ xác nhận hết hạn không bị thu hồi

> **Cập nhật 26/10/2026:** anh Đạt xác nhận có tin "Hết hạn, chưa lưu", nên nguyên nhân là **thiếu `cliMsgId`** (khả năng thứ hai bên dưới), không phải khởi động lại. Chi tiết và cách sửa ở [implementation_plan.md](implementation_plan.md). Mất hẹn giờ khi khởi động lại vẫn là lỗ hổng riêng, chưa sửa.

## Hiện tượng
Anh Đạt thấy thẻ xác nhận (ví dụ thẻ đặt lời nhắc) hết 5 phút mà vẫn còn trong chat. Theo logic cũ, hết hạn thì bot thu hồi thẻ.

## Logic hiện tại (code)
- `createPendingAction` (`transaction-confirmation.service.ts:490`) làm ba việc:
  - lưu thẻ vào Redis, TTL đúng 5 phút;
  - ghi msgId của thẻ vào danh sách tin cần thu hồi (`pending:tx:temp:<code>`, qua `setMessageId` → `addTempMessage`);
  - đặt **`setTimeout` trong bộ nhớ tiến trình**, hết 5 phút thì gọi `handleTimeout`.
- `handleTimeout` (`:1050`) lần lượt: `recallTempMessages` (thu hồi thẻ) → `deletePending` → gửi "[mã] Hết hạn, chưa lưu: …".
- Mọi loại thẻ (khoản chi, lời nhắc, việc, lịch…) đều đi qua đúng luồng này. Gần đây không có commit nào đổi luồng hết hạn.

## Thử nghiệm (script nháp, Redis giả có TTL, đã xoá sau khi chạy)
1. Tiến trình chạy liên tục: thẻ lời nhắc **được thu hồi** và có tin "Hết hạn, chưa lưu". ✅
2. Tiến trình khởi động lại trong 5 phút (cùng Redis): **không thu hồi, không báo hết hạn**. Thẻ trong Redis tự hết TTL và biến mất. ❌

## Nguyên nhân
**Gốc**: hẹn giờ hết hạn chỉ nằm trong RAM của tiến trình API. Khi khởi động không có bước nào đặt lại hẹn giờ cho các thẻ còn trong Redis (không có `onModuleInit` hay quét lại). Vì Redis cũng chỉ giữ thẻ đúng 5 phút, sau khi khởi động lại không còn dữ liệu nào để biết phải thu hồi tin nào.

**Điều kiện kích hoạt**: API khởi động lại khi đang có thẻ chờ, ví dụ deploy (hôm nay vừa lên v1.0.197), container restart hoặc crash. Đăng nhập lại ZCA không làm mất hẹn giờ.

**Khả năng thứ hai** (chưa loại trừ được vì không đọc được log prod):
- Lệnh `undo` của Zalo bị lỗi. `ZcaService.undoMessage` (`zca.service.ts:~1810`) khi đó chuyển sang `deleteMessage(onlyMe = true)`: chỉ xoá ở phía bot, người khác vẫn thấy thẻ, nhưng hàm vẫn trả `true` như đã thu hồi thành công.
- Cách phân biệt với nguyên nhân gốc:
  - Có tin "[mã] Hết hạn, chưa lưu" mà thẻ vẫn còn → do khả năng thứ hai này. Log có `Could not undo message`.
  - Không có cả tin hết hạn → do khởi động lại (nguyên nhân gốc).

## Đề xuất sửa (chờ duyệt, chưa sửa code)
1. **Hẹn giờ hết hạn chịu được khởi động lại**:
   - Lưu thẻ trong Redis lâu hơn hạn (ví dụ thêm 1 giờ). Các lệnh `yes/cancel/edit` và thả tim đã kiểm tra `expiresAt` nên không bị ảnh hưởng.
   - Giữ một set `pending:tx:open` gồm các mã đang chờ.
   - Khi API khởi động (sau khi ZCA đăng nhập): thẻ còn hạn thì đặt lại `setTimeout` cho phần thời gian còn lại; thẻ đã quá hạn thì chạy `handleTimeout` ngay (thu hồi và báo hết hạn).
   - `deletePending` xoá mã khỏi set.
2. **Không giả vờ thu hồi thành công**: lỗi `undo` thì ghi log rõ ràng, không coi `deleteMessage(onlyMe)` là đã thu hồi (trả `false`).
3. **Test**:
   - Hết hạn sau khi tạo instance mới với cùng Redis thì vẫn thu hồi.
   - Thẻ quá hạn lúc khởi động thì được thu hồi ngay.
   - `undo` lỗi thì trả `false`.

Rủi ro: thấp và chỉ trong module confirmation. Không đổi DB hay contract. Docs cần ghi thêm: thẻ hết hạn vẫn được thu hồi sau khi bot khởi động lại.
