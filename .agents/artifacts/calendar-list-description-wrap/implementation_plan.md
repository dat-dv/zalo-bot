# Kế hoạch: cột Mô tả và kéo đổi độ rộng cột trong danh sách Calendar

RequestFeedback: false

## Kết quả triển khai

- Đã triển khai sau khi được duyệt: cột Mô tả mặc định 160px, có thể thu hẹp đến 120px và tự xuống hàng.
- Đã thêm resize kéo bằng Pointer Events trên mép phải các header của bảng Calendar; độ rộng được lưu cục bộ theo `zalobot:table-widths:calendar`.
- Đã chạy thành công `npm run typecheck`, `npm run lint` và `git diff --check`.

## Mục tiêu

Ở chế độ **Bảng danh sách** của Calendar, nội dung cột **Mô tả** sẽ tự xuống hàng trong phạm vi cột hẹp hơn, thay vì bị cắt bằng dấu ba chấm trên một dòng. Người dùng cũng có thể kéo mép phải của header để tự điều chỉnh độ rộng các cột.

## Phạm vi và ảnh hưởng

- Sửa cấu hình cột `description` trong `apps/web/src/modules/dashboard/view/calendar-screen.tsx`:
  - đặt chiều rộng ưu tiên hẹp hơn (khoảng 160px) và giới hạn tối thiểu để bảng vẫn đọc được;
  - gắn class riêng cho ô hiển thị mô tả.
- Bổ sung CSS cục bộ trong `apps/web/src/styles.css` để nội dung mô tả được ngắt dòng an toàn (`white-space`/`overflow-wrap`), không làm thay đổi cách hiển thị một dòng của các cột dùng `.cell-muted` khác.
- Mở rộng `apps/web/src/shared/ui/data-table.tsx` bằng một tùy chọn bật tính năng kéo đổi độ rộng cột:
  - hiển thị vùng kéo ở mép phải từng header;
  - cập nhật độ rộng cột trong lúc kéo, có ngưỡng nhỏ nhất theo `minWidth`;
  - lưu độ rộng theo `id` bảng trong trình duyệt để giữ lại khi tải lại trang;
  - xử lý chuột và cảm ứng qua Pointer Events, tránh tạo thao tác kéo ngoài ý muốn trên các bảng khác.
- Bật tùy chọn này duy nhất cho `DataTable` có `id="calendar"` trong `calendar-screen.tsx`.
- Cập nhật mô tả yêu cầu UI/UX tương ứng tại:
  - `.agents/knowledge/modules/calendar/README.md` (English)
  - `.agents/docs/modules/calendar/README.md` (Vietnamese)

## Cách thực hiện

1. Điều chỉnh riêng column `description` ở List View; không thay đổi Grid View, dữ liệu, API hoặc luồng inline edit.
2. Tạo class mô tả đa dòng theo hướng dữ liệu dày đặc: ô chỉ cao thêm khi nội dung cần thiết, ưu tiên ngắt từ dài để không làm tràn bảng.
3. Bổ sung cơ chế resize opt-in trong `DataTable`, áp dụng CSS cho resize handle và trạng thái khi kéo; không bật mặc định để tránh thay đổi giao diện/hành vi các bảng đang có.
4. Giữ tính tương thích giao diện sáng/tối nhờ kế thừa màu từ `.cell-muted` hiện có.
5. Chạy `npm run lint` và `npm run typecheck`; nếu môi trường sẵn sàng, kiểm tra trực quan List View để xác nhận cột Mô tả thu hẹp, xuống dòng và các header kéo được đúng.

## Rủi ro và hoàn tác

- Rủi ro trung bình thấp: thay đổi chung `DataTable` nhưng chỉ kích hoạt từ Calendar. Hàng có mô tả dài có thể cao hơn trước, đây là hệ quả chủ đích để đọc hết nội dung.
- Có thể hoàn tác độc lập bằng cách tắt tùy chọn resize của Calendar, bỏ class bọc dòng và khôi phục kích thước cột.

## Phát hiện hiện tại

- `description` đang có `minWidth: '180px'` và dùng `.cell-muted`, class này áp `white-space: nowrap` cùng ellipsis.
- `DataTable` hiện dùng `colgroup`, nên độ rộng đang quản lý tập trung và có thể cập nhật nhất quán cho header lẫn các ô dữ liệu.
- Working tree hiện có thay đổi không liên quan ở Dashboard/Category autocomplete; kế hoạch và triển khai sẽ không đụng vào các thay đổi đó.
