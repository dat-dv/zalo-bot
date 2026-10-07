# Kế hoạch: Đồng bộ menu zalo, tool call và Dashboard

RequestFeedback: true

## Mục tiêu

Đưa menu lệnh zalo, các nút trong `/start` và `/help`, và các hành động nhanh về cùng một danh mục duy nhất. Bổ sung Dashboard vào menu hiển thị, đồng thời bố trí các nút theo hàng 2 cột để giảm chiều cao màn hình mà vẫn đủ vùng chạm trên điện thoại.

## Bằng chứng hiện trạng

- `apps/api/src/zalo/services/zalo-ui.service.ts` tạo menu inline bằng từng nút một hàng; đây là nguyên nhân danh sách nút kéo dài như ảnh chụp.
- `apps/api/src/zalo/zalo.update.ts` đã có handler `/dashboard` và nhận diện tin nhắn Dashboard, nhưng menu inline hiển thị nhãn `📊 Xem báo cáo`; lệnh hiển thị trong zalo không được khai báo tập trung trong mã.
- Các action nhanh hiện có gồm: hôm nay, việc cần làm, lịch 7 ngày, thu–chi, công nợ, trạng thái, người dùng và link mời. Chúng không cùng một nguồn với các command/tool handler, nên dễ thiếu hoặc lệch nhãn.
- Kiểm tra hệ thống đã đạt: 73 artifacts, 132 dependencies, 53 pairs, không có vòng lặp phụ thuộc. Worktree sạch.

## Phạm vi thực hiện

1. Tạo một danh mục menu dùng chung tại khu vực zalo:
   - Mỗi mục có command zalo, nhãn/biểu tượng, mô tả ngắn, callback hoặc URL Dashboard, và quyền hiển thị (mọi người/admin).
   - Bao phủ các thao tác hiện có: Dashboard, Lịch hôm nay, Lịch 7 ngày, Việc cần làm, Thu–chi, Công nợ, Trạng thái; thêm các thao tác quản trị phù hợp với Admin (Danh sách user, Tạo link mời). Giữ `/help`, `/start`, `/login`, `/ban` là lệnh điều hướng/hệ thống thay vì dồn vào dãy action chính.
1. Đăng ký command menu zalo từ danh mục đó khi bot khởi động:
   - Người dùng nhìn thấy command, nhãn và mô tả cùng nội dung với nút nhanh.
   - Dùng scope phù hợp để mục quản trị không lộ cho người dùng thường; nếu zalo không hỗ trợ thay đổi menu theo từng user trong phiên, command admin vẫn được bảo vệ bởi handler hiện hữu và menu mặc định chỉ chứa các mục chung.
1. Dựng inline menu từ danh mục chung:
   - Đổi nhãn thành `📊 Dashboard` và đặt Dashboard trong nhóm thao tác chính khi tạo được URL truy cập.
   - Chuyển các action callback thành hai nút mỗi hàng; nút Dashboard là URL và đặt cùng hàng khi có thể. Các hàng lẻ sẽ tự căn đúng, không tạo khoảng trống giả.
   - Giữ luồng chưa kết nối Google: chỉ hiện nút đăng nhập, tránh hiển thị action phụ thuộc Google.
   - Bảo toàn callback cũ `action:view_reports` để các tin nhắn đã gửi trước đó vẫn hoạt động.
1. Bổ sung/điều chỉnh kiểm thử:
   - Xác minh danh mục chung tạo ra menu `/start` và `/help` giống hệt nhau.
   - Xác minh Dashboard là URL trực tiếp, xuất hiện khi có link, và các action được đóng gói tối đa hai nút mỗi hàng.
   - Xác minh command/menu không làm lộ action Admin cho người dùng thường; callback admin vẫn bị kiểm tra quyền ở handler.
1. Đồng bộ tài liệu bắt buộc:
   - Cập nhật canonical knowledge tiếng Anh và developer docs tiếng Việt cho zalo/dashboard, bao gồm quy tắc menu 2 cột, nguồn danh mục chung, quyền admin và hành vi Dashboard.
   - Cập nhật chỉ mục docs nếu xuất hiện tài liệu module zalo mới.

## Tệp dự kiến tác động

- `apps/api/src/zalo/services/zalo-ui.service.ts`
- `apps/api/src/zalo/zalo.update.ts`
- `apps/api/src/zalo/zalo.module.ts` (hoặc provider khởi động dành riêng để đăng ký menu command)
- `apps/api/src/zalo/services/zalo-ui.service.spec.ts` và các test zalo liên quan
- `.agents/knowledge/...` và `.agents/docs/...` tương ứng

## Rủi ro và kiểm chứng

- Rủi ro trung bình: thay đổi menu công khai của bot và bố cục điều khiển. Không thay đổi API, dữ liệu hay quyền truy cập thực tế.
- Chạy test zalo liên quan, `npm run lint`, `npm run typecheck`, và kiểm tra build API sau khi thực hiện.
- Kiểm thử hồi quy Dashboard để đảm bảo token URL vẫn được tạo/ẩn an toàn theo cấu hình hiện tại.

## Quyết định UX đề xuất

- Một danh mục chung là nguồn chuẩn; không sao chép nhãn/danh sách vào command, `/help`, `/start` hay callback.
- Bố cục 2 cột cho action ngắn để giảm gần một nửa chiều cao; ưu tiên thứ tự: Dashboard → Hôm nay → Việc → 7 ngày → Thu–chi → Công nợ → Trạng thái → Admin.

## Kết quả triển khai

- Hoàn tất danh mục menu dùng chung tại `apps/api/src/zalo/zalo-menu.catalog.ts`.
- `/start` đồng bộ command menu riêng cho chat theo vai trò người dùng; các mục admin chỉ xuất hiện với Admin.
- `/start` và `/help` dùng cùng danh mục để dựng inline menu tối đa hai nút mỗi hàng. Dashboard là URL trực tiếp với nhãn `📊 Dashboard`.
- Giữ callback báo cáo cũ để các tin nhắn bot đã gửi trước khi nâng cấp vẫn sử dụng được.
- Cập nhật kiểm thử, mock hồi quy Dashboard, canonical knowledge và tài liệu vận hành.

## Xác minh đã chạy

- `npm run lint:check --workspace @zalobot/api`
- `npm run typecheck --workspace @zalobot/api`
- `npm run build:api`
- `npx tsx --test apps/api/src/zalo/services/zalo-ui.service.spec.ts` — 7/7 đạt
- `node apps/api/scripts/check-zalo-command-fallback.cjs`
- `git diff --check`
