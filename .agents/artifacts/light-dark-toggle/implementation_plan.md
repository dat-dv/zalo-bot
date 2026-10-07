---
RequestFeedback: true
---

# Kế hoạch: nút chuyển giao diện sáng/tối

## Mục tiêu

Thêm một nút chuyển Light/Dark dùng được trên toàn bộ dashboard zalobot, có nhãn và trạng thái rõ ràng, phù hợp với sidebar desktop và thanh điều hướng ngang trên mobile.

## Hiện trạng đã xác nhận

- Toàn bộ dashboard dùng stylesheet chung tại `apps/web/src/styles.css`; các màu hiện đang là mã màu cố định cho light mode.
- `ReportsNavigation` là component sidebar dùng chung cho các trang báo cáo và chưa có cơ chế theme.
- `AppProviders` là client boundary có sẵn cho toàn ứng dụng, phù hợp để quản lý lựa chọn theme phía trình duyệt.
- Workspace đang có các thay đổi chưa commit ở stylesheet, các màn hình dashboard/contacts/debts/expenses và tài liệu liên quan. Những thay đổi này sẽ được giữ nguyên, không ghi đè.

## Phạm vi thực hiện đề xuất

1. Thêm theme provider/hook dùng `localStorage` để lưu lựa chọn `light` hoặc `dark`; lần truy cập đầu tiên dùng tùy chọn hệ thống nếu có.
2. Áp dụng theme vào phần tử gốc của tài liệu ngay khi khởi tạo để tránh giao diện bị nháy light mode; vẫn bảo đảm ứng dụng hoạt động khi không truy cập được `localStorage`.
3. Thêm nút icon có tên truy cập được ở cuối `ReportsNavigation`; nút hiển thị hành động kế tiếp (bật tối hoặc bật sáng), dùng được bằng bàn phím và có trạng thái focus rõ ràng.
4. Chuyển các màu dùng chung trong `apps/web/src/styles.css` sang biến màu, đồng thời bổ sung dark palette có độ tương phản phù hợp cho nền, text, border, hover, bảng dữ liệu, cảnh báo và trạng thái semantic. Giữ nguyên bố cục/data density hiện tại.
5. Cập nhật knowledge và developer guide của dashboard để ghi nhận hành vi theme (lưu cục bộ, vị trí nút, responsive/accessibility).

## Tệp dự kiến tác động

- `apps/web/src/shared/providers/app-providers.tsx` và một component/hook theme dùng chung mới (nếu cần tách để giữ component gọn).
- `apps/web/app/layout.tsx` để đặt theme ban đầu an toàn.
- `apps/web/src/shared/ui/reports-navigation.tsx` để đặt nút chuyển giao diện.
- `apps/web/src/styles.css` để dùng token light/dark và style nút.
- `.agents/knowledge/modules/dashboard/README.md`, `.agents/docs/modules/dashboard/README.md` và `.agents/docs/README.md`.

## Kiểm thử sau khi triển khai

- Chạy `npm run lint`, `npm run typecheck` và `npm run build`.
- Mở các trang Reports desktop/mobile, chuyển theme qua lại; tải lại trang để xác nhận lựa chọn được giữ.
- Kiểm tra focus bàn phím, accessible name của nút, và tương phản ở bảng dữ liệu/cảnh báo.

## Rủi ro và cách kiểm soát

- Dark mode cần phủ toàn bộ màu hard-code hiện có: dùng token CSS ở tầng chung để tránh phải sửa từng màn hình và giảm rủi ro bỏ sót.
- Để không ảnh hưởng thay đổi đang có trong `styles.css`, chỉ chỉnh theo đúng các vùng palette/theme và đối chiếu diff trước khi hoàn tất.

## Kết quả triển khai

- Hoàn tất theme provider dùng chung, script khởi tạo trước khi render, và nút chuyển giao diện tại footer của thanh điều hướng.
- Hoàn tất dark palette cho các surface, navigation, bảng dữ liệu, skeleton, cảnh báo và trạng thái semantic chính; mobile có vùng bấm tối thiểu 44px.
- Đã cập nhật tài liệu dashboard và chạy thành công `npm run lint`, `npm run typecheck`, `npm run build`, cùng `git diff --check`.
