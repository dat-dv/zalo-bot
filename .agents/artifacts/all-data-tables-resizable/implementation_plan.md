# Kế hoạch: resize và ghi nhớ độ rộng cho mọi DataTable

RequestFeedback: false

## Kết quả triển khai

- `DataTable` tự bật kéo resize cho mọi bảng có `id` và vẫn có thể tắt rõ ràng bằng `allowColumnResize={false}`.
- Mỗi bảng lưu độ rộng riêng vào `zalobot:table-widths:<id>`; Calendar không còn cần cấu hình đặc biệt.
- Đã chạy thành công `npm run typecheck`, `npm run lint` và `git diff --check`.

## Mục tiêu

Mọi bảng đang dùng `DataTable` có `id` sẽ cho phép kéo mép phải của header để thay đổi độ rộng cột. Mỗi bảng sẽ ghi nhớ riêng độ rộng này trong localStorage và khôi phục khi người dùng quay lại hoặc tải lại trang.

## Phạm vi

- Sửa duy nhất component dùng chung `apps/web/src/shared/ui/data-table.tsx`:
  - bật resize mặc định khi bảng có `id`;
  - duy trì cơ chế opt-out cho trường hợp bảng mới không muốn resize;
  - dùng khoá `zalobot:table-widths:<id>` hiện có để cô lập thiết lập của từng bảng.
- Xóa thuộc tính bật riêng không còn cần thiết ở Calendar, vì Calendar đã có `id="calendar"`.
- Cập nhật tài liệu shared UI/global cho quy ước DataTable; không đổi API, dữ liệu, logic nghiệp vụ hoặc cấu hình từng module.

## Cách thực hiện

1. Đổi giá trị mặc định `allowColumnResize` theo sự tồn tại của `id`, tương tự cơ chế hiển thị quản lý cột hiện tại.
2. Giữ quy tắc min-width theo từng column và lọc dữ liệu localStorage theo các column còn hợp lệ.
3. Đảm bảo mọi DataTable hiện hữu đều đã có `id` riêng; kiểm tra này đã xác nhận các bảng trong web app đều được định danh (Transactions, Tasks, Expenses, Analytics, Reminders, Dashboard Home, Settings, Contacts, Debts và Calendar).
4. Chạy `npm run typecheck`, `npm run lint` và `git diff --check`.

## Rủi ro và hoàn tác

- Rủi ro thấp: thay đổi hành vi giao diện thống nhất của component chung, không ảnh hưởng dữ liệu hay API.
- Có thể hoàn tác chỉ bằng việc đưa mặc định về tắt; các giá trị localStorage thừa sẽ bị bỏ qua an toàn.
