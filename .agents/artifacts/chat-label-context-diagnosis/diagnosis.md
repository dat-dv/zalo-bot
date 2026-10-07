# Chẩn đoán: nhãn thao tác chat thiếu ngữ cảnh

## Quan sát

- Trong phản hồi `/week`, bot hiển thị các nút thao tác dành cho `/today`, gồm `🔄 Cập nhật` và `📝 Việc cần làm`.
- Nhãn `💳 Công nợ` trong menu nhanh không mô tả phạm vi dữ liệu mà nó mở.

## Bằng chứng

- `apps/api/src/zalo/zalo.update.ts:471` gọi `buildTodayActionsMarkup()` sau khi lấy tổng hợp tuần.
- `apps/api/src/zalo/services/zalo-ui.service.ts:94-100` tạo nút `🔄 Cập nhật` với callback `action:refresh_today`.
- `apps/api/src/zalo/zalo.update.ts:794-798` xác nhận callback này luôn gọi `onToday()`.
- Kiểm thử cô lập đã chạy: gọi `zaloUpdate.onWeek()` với UI giả lập và kiểm tra bộ hành động theo tuần. Kết quả hiện tại: `Expected /week to attach week-scoped actions, but got: today`.
- `apps/api/src/zalo/zalo-menu.catalog.ts:50-55` đặt nhãn `💳 Công nợ`, trong khi lệnh thực tế chỉ liệt kê các khoản chưa tất toán và tách `Cần thu`/`Cần trả`.

## Nguyên nhân gốc

Lớp điều phối zalo tái sử dụng bộ nút của báo cáo hôm nay cho báo cáo 7 ngày. Callback và nhãn của nút vì vậy không đồng nhất với nội dung tin nhắn. Đồng thời các nhãn menu ưu tiên ngắn gọn nhưng chưa bổ sung đủ ý nghĩa nghiệp vụ.

## Phạm vi ảnh hưởng

- `/week` và nút `📈 Lịch 7 ngày`: có nút `Cập nhật` nhưng thực tế chuyển sang tóm tắt hôm nay.
- Menu xuất hiện sau `/start` và `/help`: mục `Công nợ` thiếu mô tả trực tiếp về số dư đang mở.

## Khắc phục đề xuất

1. Tạo bộ hành động riêng cho báo cáo 7 ngày với nhãn rõ ràng, ví dụ `🔄 Cập nhật lịch 7 ngày`, và callback gọi lại `onWeek()`.
2. Giữ bộ hành động hôm nay nhưng đổi `🔄 Cập nhật` thành `🔄 Cập nhật lịch hôm nay` để không mơ hồ.
3. Đổi nhãn menu thành `💳 Công nợ đang mở` hoặc `💳 Cần thu / cần trả`; giữ callback hiện có.
4. Bổ sung kiểm thử cho `onToday()` và `onWeek()` để mỗi lệnh gắn đúng bộ hành động và callback đúng phạm vi.

## Rủi ro và xác minh sau khi sửa

- Rủi ro thấp: chỉ thay nhãn và điều phối callback, không thay đổi dữ liệu công nợ, lịch hoặc Google API.
- Xác minh: chạy kiểm thử cô lập hiện tại, kiểm tra `/today`, `/week`, `/start`, `/help` trên zalo; bảo đảm nút theo tuần không gọi báo cáo hôm nay.
