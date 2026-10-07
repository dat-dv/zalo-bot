---
RequestFeedback: true
Status: completed
Route: implement
Authority: edit-repository
Risk: medium
---

# Kế hoạch thiết kế lại thanh điều hướng theo phong cách quản trị

## Mục tiêu

Biến thanh điều hướng bên trái của dashboard zalobot thành một sidebar mang cảm giác ứng dụng quản trị: nhận diện sản phẩm rõ ràng, nhóm điều hướng dễ quét, trạng thái trang đang mở nổi bật vừa đủ, và khu vực trạng thái hệ thống tách bạch. Giữ nguyên toàn bộ đường dẫn, dữ liệu và nghiệp vụ hiện có.

## Hiện trạng đã xác nhận

- `apps/web/src/shared/ui/reports-navigation.tsx` hiện có thương hiệu, năm liên kết chức năng và một footer tuỳ chọn; component này được các màn hình báo cáo dùng chung.
- `apps/web/src/styles.css` đang dùng sidebar rất tối giản với đường viền phải, chưa có cấu trúc điều hướng kiểu admin như tiêu đề nhóm, biểu tượng nhất quán, vùng nhận diện thương hiệu hay vùng trạng thái riêng.
- Mobile hiện chuyển sidebar thành dải liên kết cuộn ngang. Hướng này phù hợp với dashboard dữ liệu và sẽ được giữ, nhưng sẽ tinh gọn nhận diện để không chiếm không gian nội dung.
- Hệ thống UI áp dụng hướng Flat Enterprise/Data-Dense: nền trung tính, viền mảnh, không gradient, không shadow nặng và trạng thái màu chỉ dùng khi có ý nghĩa.

## Phạm vi triển khai đề xuất

1. Cập nhật `apps/web/src/shared/ui/reports-navigation.tsx`:
   - Bổ sung biểu tượng SVG nhỏ, có nhãn truy cập phù hợp, cho từng mục để quét nhanh hơn.
   - Tổ chức sidebar thành các vùng: nhận diện zalobot, nhãn nhóm “Báo cáo”, các mục điều hướng và khu vực footer/trạng thái.
   - Không đổi `ReportsNavigationPage`, `APP_ROUTES`, URL, props `active`/`footer`, hay hành vi liên kết.
2. Cập nhật các style navbar trong `apps/web/src/styles.css`:
   - Tạo rail/sidebar gọn, màu nền và đường phân tách trung tính; thương hiệu có dấu hiệu nhận diện nhỏ thay vì trang trí nặng.
   - Định nghĩa trạng thái mặc định, hover, active, focus-visible và status theo đúng tương phản/accessibility.
   - Cho trạng thái active có nền xanh rất nhạt, vạch nhận biết tinh tế và icon/text nhất quán; không dùng badge hay shadow nặng.
   - Điều chỉnh responsive: desktop giữ sidebar sticky; mobile dùng navigation ngang cuộn được, mục active rõ ràng, status không làm vỡ layout.
3. Cập nhật tài liệu UI vì thay đổi quy ước trải nghiệm dùng chung:
   - `.agents/knowledge/global/web-ui-direction.md` (English): bổ sung hợp đồng điều hướng sidebar/mobile và các trạng thái tương tác.
   - `.agents/docs/global/web-ui-direction.md` (Vietnamese): ghi hướng dẫn sử dụng và checklist kiểm tra navbar.

## Ngoài phạm vi

- Không thêm mục menu, quyền truy cập, tìm kiếm, menu tài khoản, thông báo, thu gọn sidebar hay thay đổi backend/API.
- Không thay đổi layout nội dung, bảng dữ liệu, query, xác thực hoặc luồng đăng xuất.
- Không thêm thư viện icon; dùng SVG nội tuyến nhỏ để tránh dependency mới.

## Tiêu chí nghiệm thu

- Sidebar desktop trông như khu vực điều hướng của ứng dụng quản trị: phân cấp rõ, quét nhanh và không lấn át dữ liệu.
- Toàn bộ 5 đường dẫn hiện hữu hoạt động không thay đổi; trang hiện tại có `aria-current="page"`, nhãn text và trạng thái active dễ nhận biết.
- Điều hướng dùng được bằng bàn phím, có focus-visible rõ và màu đạt độ tương phản cần thiết.
- Trên mobile, navigation không tràn viewport và vẫn cuộn ngang được khi cần.
- Chạy `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web` và kiểm tra trực quan các trang `/reports`, `/reports/statistics`, `/reports/contacts`, `/reports/debts`, `/reports/expenses` sau khi triển khai.

## Rủi ro và cách kiểm soát

- Component dùng chung trên toàn bộ dashboard nên thay đổi markup/CSS có thể ảnh hưởng nhiều màn hình; giữ nguyên public props và kiểm tra từng route.
- SVG icon có thể làm nhãn không rõ nếu chỉ dựa vào hình; mỗi link vẫn giữ text hiển thị và thêm thuộc tính accessibility phù hợp.
- Mobile có ít không gian; giữ nav theo hàng ngang cuộn thay vì ép mục thành menu nhiều tầng.

## Kết quả triển khai

- Đã cập nhật sidebar báo cáo với dấu nhận diện zalobot, nhãn nhóm, icon SVG kèm nhãn chữ và vùng footer/trạng thái riêng.
- Đã bổ sung các trạng thái hover, active, focus-visible; active có nền xanh nhạt và thanh nhận diện nhỏ. Mobile tiếp tục dùng dải điều hướng ngang cuộn được.
- Đã cập nhật hướng dẫn UI chuẩn hoá cho sidebar trên desktop và mobile.
- Đã chạy thành công `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web`, `npm run build --workspace @zalobot/web` và `git diff --check`.
- Kiểm tra trực quan tự động không thực hiện được vì môi trường không có lệnh `agent-browser`; máy chủ local đã khởi động thành công trước khi dừng.
