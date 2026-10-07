# Kế hoạch: gỡ UI trạng thái kết nối Google

RequestFeedback: true

## Kết quả thực hiện

- Đã gỡ nhãn trạng thái Google tại sidebar và tiêu đề dashboard.
- Đã gỡ CSS chỉ phục vụ các nhãn này, gồm quy tắc responsive.
- Đã xác minh bằng `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web`, và `git diff --check`.

## Mục tiêu

Loại bỏ các nhãn trạng thái kết nối Google khỏi dashboard web, gồm nhãn ở thanh điều hướng và nhãn ở phần tiêu đề. Không thay đổi luồng xác thực Google hay dữ liệu dashboard.

## Phạm vi đã xác nhận

- `apps/web/src/modules/dashboard/view/dashboard-screen.tsx`
  - Không truyền footer trạng thái Google vào `ReportsNavigation`.
  - Gỡ badge `Google đã kết nối` / `Chưa kết nối Google` tại tiêu đề; giữ các nút `Làm mới` và `Đăng xuất`.
- `apps/web/src/styles.css`
  - Gỡ các quy tắc CSS chỉ phục vụ hai nhãn trạng thái đã loại bỏ, kể cả biến thể responsive.

## Không thay đổi

- Trạng thái `googleConnected` vẫn được dùng cho thông điệp rỗng của lịch và công việc.
- Số liệu quản trị `đã kết nối Google` vẫn giữ nguyên.
- API, xác thực Google, và các màn hình zalo không bị tác động.

## Xác minh sau khi thực hiện

1. Chạy kiểm tra kiểu dữ liệu cho web.
2. Chạy lint cho web.
3. Kiểm tra giao diện dashboard: không còn hai nhãn trạng thái Google, còn các nút làm mới và đăng xuất.

## Rủi ro và hoàn tác

Rủi ro thấp, giới hạn ở việc giảm thông tin hiển thị. Có thể hoàn tác bằng cách khôi phục các phần JSX và CSS tương ứng.
