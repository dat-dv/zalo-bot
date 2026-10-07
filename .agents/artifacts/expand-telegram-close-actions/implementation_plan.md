---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch: mở rộng thao tác đóng cho các tin nhắn zalo còn lại

## Mục tiêu

Không để người dùng bị kẹt với các tin nhắn danh sách hoặc thông tin có bàn phím inline. Mỗi màn hình tác vụ dài hạn sẽ có nút `❌ Đóng` để xóa tin nhắn, hoặc gỡ bàn phím nếu zalo không cho phép xóa.

## Phạm vi được chọn

### Thêm nút đóng

- Tổng kết hôm nay: các nút `Cập nhật` và `Việc cần làm`.
- Danh sách công việc: các nút hoàn tất từng việc.
- Trạng thái tài khoản.
- Danh sách người dùng quản trị.
- Tin nhắn mở Dashboard và báo cáo.
- Chi tiết từng khoản công nợ: giữ nút `❌ Đóng` đã triển khai.

Các builder tập trung tại `zaloUiService` sẽ nhận callback đóng chung hoặc callback theo ngữ cảnh. Một handler dùng chung sẽ trả callback query, gọi `deleteMessage()`, rồi gỡ inline keyboard nếu xóa thất bại.

### Không đổi hành vi các luồng sau

- Menu chính `/start` và các nút URL đăng nhập Google vẫn là điều hướng/khôi phục truy cập, không thêm nút đóng.
- Hộp xác nhận thao tác và xác nhận voice giữ `Hủy`: đó là thao tác hủy yêu cầu, không chỉ đóng giao diện.
- Reminder và Calendar giữ `Ẩn nút`: chúng là biên nhận thao tác cần được giữ lại trong lịch sử chat; người dùng vẫn có thể xóa tin nhắn bằng thao tác chuẩn của zalo.

## Kiểm thử và tài liệu

1. Mở rộng test `zaloUiService` để các markup thuộc phạm vi có callback đóng đúng và không làm thay đổi callback nghiệp vụ hiện hữu.
2. Thêm test handler hoặc test đơn vị ở seam phù hợp cho phương án xóa/gỡ keyboard an toàn.
3. Cập nhật canonical knowledge tiếng Anh và hướng dẫn tiếng Việt về phân biệt: màn hình danh sách có `Đóng`; hộp xác nhận dùng `Hủy`; biên nhận Reminder/Calendar dùng `Ẩn nút`.
4. Chạy test zalo liên quan, `npm run typecheck`, `npm run lint`.

## Tệp dự kiến ảnh hưởng

- `apps/api/src/zalo/services/zalo-ui.service.ts`
- `apps/api/src/zalo/zalo.update.ts`
- `apps/api/src/zalo/services/zalo-ui.service.spec.ts`
- Có thể thêm `apps/api/src/zalo/zalo.update.spec.ts` nếu cần một seam kiểm thử handler.
- `.agents/knowledge/global/zalo-response-layout.md`
- `.agents/docs/global/zalo-response-layout.md`

## Rủi ro

- Không đụng dữ liệu công nợ, công việc, lịch hay API.
- Nút đóng chung phải chỉ xóa chính tin nhắn chứa nó; fallback gỡ keyboard bảo đảm không để lại action cũ khi zalo không cho xóa.
- Workspace đang có thay đổi chưa cam kết ở các tính năng báo cáo khác; không nằm trong phạm vi này và sẽ được giữ nguyên.
