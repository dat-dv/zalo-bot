# Kế hoạch triển khai: cột STT và ID cho bảng dữ liệu

RequestFeedback: true

## Mục tiêu

Mọi bảng dùng `DataTable` trên giao diện web sẽ hiển thị hai cột bắt buộc ở đầu bảng:

1. `STT`: số thứ tự theo danh sách dòng hiện đang hiển thị, bắt đầu từ 1.
2. `ID`: định danh bản ghi từ trường `row.id`.

## Phạm vi đã xác nhận

- Component dùng chung: `apps/web/src/shared/ui/data-table.tsx`.
- Chuỗi giao diện dùng chung trong `packages/contracts/src/index.ts` (nếu thêm khóa dịch cho tiêu đề `STT` và `ID`).
- 17 lần sử dụng `DataTable` hiện có đều truyền dữ liệu mang trường `id` và `getRowKey` dựa trên trường đó; không cần thêm cột thủ công tại từng màn hình.

## Thay đổi dự kiến

1. Mở rộng khả năng dựng ô của `DataTable` để biết chỉ mục dòng; tạo hai cột hệ thống `STT` và `ID` trước các cột nghiệp vụ.
2. Đặt hai cột này là bắt buộc, không cho ẩn qua phần cài đặt cột, có độ rộng gọn; ID dùng kiểu chữ mono để dễ quét.
3. Bảo toàn cách hiển thị, ẩn/hiện, đổi độ rộng và lưu cài đặt cho các cột nghiệp vụ hiện hữu; không thay đổi dữ liệu API hoặc kiểu hợp đồng.
4. Thêm bản dịch Việt/Anh cho tiêu đề cột nếu hệ thống i18n hiện tại yêu cầu khóa dịch mới.
5. Chạy kiểm tra TypeScript và lint cho workspace sau khi sửa; kiểm tra thủ công một bảng có lựa chọn dòng và một bảng ở dashboard để bảo đảm STT/ID đứng trước các cột hiện hữu.

## Rủi ro và cách xử lý

- Cài đặt ẩn/hiện cột đã lưu trong trình duyệt có thể không chứa các cột mới. Hai cột hệ thống sẽ luôn được gộp trở lại khi tải cấu hình để vẫn hiển thị.
- STT phản ánh thứ tự sau lọc/sắp xếp phía giao diện, không phải số thứ tự cố định trong cơ sở dữ liệu.
- Có thay đổi chưa commit của người dùng ở `data-table.tsx` và một số tệp khác; chỉ bổ sung tối thiểu, không ghi đè các thay đổi đó.

## Tiêu chí chấp nhận

- Mỗi `DataTable` có header `STT`, `ID`, sau đó mới đến cột nghiệp vụ.
- Mỗi dòng có STT bắt đầu từ 1 và ID đúng với `row.id`.
- Người dùng không thể ẩn hai cột này; thao tác cấu hình cột hiện có vẫn hoạt động.
- Lint và typecheck thành công, hoặc báo rõ lỗi có sẵn ngoài phạm vi.

## Kết quả thực hiện

- `DataTable` đã yêu cầu mỗi dòng có `id`, tự thêm cột `STT` và `ID` trước các cột nghiệp vụ, đồng thời bảo vệ hai cột này khỏi thao tác ẩn.
- Cấu hình cột và độ rộng đã lưu vẫn được đọc an toàn; các cột bắt buộc mới luôn được đưa lại vào danh sách hiển thị.
- Đã thêm bản dịch Việt/Anh và cập nhật tài liệu UI dùng chung.
- Xác minh: `npm run lint` và `npm run typecheck` đều thành công sau khi build `@zalobot/contracts`.
