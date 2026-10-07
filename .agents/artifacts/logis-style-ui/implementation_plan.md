---
RequestFeedback: true
Status: completed
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch đồng bộ phong cách UI với `logis-project`

## Mục tiêu

Đưa dashboard web của zalobot về cùng ngôn ngữ giao diện với `~/Documents/projects/logis-project`: Flat Enterprise, data-dense, nền trung tính, border mảnh và thao tác theo kiểu Excel-lite. Trọng tâm là tạo table dùng chung có cấu trúc nhất quán thay cho các dòng `div` hiện tại.

## Hiện trạng đã xác nhận

- `apps/web/src/app.tsx` hiện có sáu khu vực dữ liệu, mỗi khu vực dùng helper `Table`/`Panel` nội bộ và các hàng dạng CSS grid.
- `apps/web/src/styles.css` đã dùng màu slate và border cơ bản, nhưng chưa có primitive table tái dùng, toolbar, header cột, loading skeleton, hay khung cuộn ngang theo workflow bảng dữ liệu.
- Tham chiếu `logis-project/packages/ui/src/components/common-table.tsx` và `data-table/*` cung cấp các nguyên tắc nên áp dụng: một data surface thống nhất, toolbar gắn trực tiếp với table, header cao 36–40px, row 40–48px, divider mảnh, hover/selected nhẹ, trạng thái loading/empty rõ ràng, và responsive bằng cuộn ngang thay vì card hóa dữ liệu.
- `npm run agent-system:validate` không tồn tại trong repository hiện tại; sẽ không tự thêm hay sửa script ngoài phạm vi UI.

## Phạm vi triển khai đề xuất

1. Tạo primitive UI dùng chung trong `apps/web/src/components/`:
   - `DataTable`: semantic HTML (`table`, `thead`, `tbody`), column definitions tối giản, sticky-neutral header, desktop density 40–48px, horizontal scroll khi màn hình hẹp.
   - `DataPanel`: surface phẳng gồm title/metadata, optional toolbar và phần nội dung table; không lồng card dư thừa.
   - Trạng thái loading skeleton, empty state nhỏ gọn, error/aria properties phù hợp; focus state rõ cho control.
2. Refactor `apps/web/src/app.tsx` để từng khu vực (giao dịch, công nợ, lịch, tasks, reminders, activity) khai báo cột và dùng `DataTable` chung:
   - Gắn nhãn header không emoji, căn trái dữ liệu mô tả và căn phải số tiền.
   - Giữ nguyên hoàn toàn dữ liệu, API calls, refresh/logout, nội dung tiếng Việt và business logic.
   - Chuyển metric strip và admin strip sang surface/border/typography cùng hệ để toàn trang đồng nhất.
3. Cập nhật `apps/web/src/styles.css` thành design tokens cùng tinh thần reference (neutral surface, border, typography, semantic status), controls compact, table divider/hover/focus, responsive layout và horizontal overflow.
4. Cập nhật tài liệu UI bắt buộc vì đây là thay đổi quy ước giao diện:
   - `.agents/knowledge/modules/ui/design-direction.md` (English, mô tả primitive và responsive/data-table contract).
   - `.agents/docs/modules/ui/design-direction.md` (Vietnamese, hướng dẫn dùng/kiểm tra table).
   - `.agents/docs/README.md` chỉ khi index hiện chưa liên kết đúng tài liệu module UI.

## Ngoài phạm vi

- Không migrate sang Next.js, Tailwind, shadcn hoặc sao chép nguyên bộ `packages/ui` của `logis-project`.
- Không thêm sorting, filtering, pagination, column persistence hay row editing ở đợt này vì dashboard API hiện trả danh sách ngắn và chưa có hợp đồng dữ liệu cho các thao tác ấy.
- Không thay đổi API, authentication, dashboard query, hay dữ liệu backend.

## Tiêu chí nghiệm thu

- Mọi bảng dashboard dùng cùng một primitive và có semantic header/cell.
- Header table 36–40px, row mặc định 40–48px; không shadow nặng, không nested cards, không emoji trong header.
- Màn hẹp cuộn ngang bảng mượt, toolbar/header không vỡ bố cục; bảng không bị biến thành card list.
- Đủ 4 trạng thái loading, error, empty và success với `aria-busy`/`role=alert` phù hợp.
- `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web`, và `npm run build --workspace @zalobot/web` chạy sau khi triển khai.

## Rủi ro và cách kiểm soát

- Thay đổi component lặp lại trên sáu bảng nên là rủi ro trung bình về render/type; giảm rủi ro bằng generic types đơn giản và kiểm tra build/typecheck.
- Không thêm dependency từ project tham chiếu để tránh tăng bundle và tạo coupling giữa hai repository độc lập.

## Kết quả triển khai

- Đã tạo `apps/web/src/components/data-table.tsx` với `DataPanel` và `DataTable` dùng chung.
- Đã chuyển sáu danh sách dashboard sang table semantic, compact và responsive, không đổi API hay business logic.
- Đã thêm loading skeleton, empty state, table hover/focus và style Flat Enterprise trong `apps/web/src/styles.css`.
- Đã cập nhật tài liệu tri thức và hướng dẫn UI tương ứng.
- Đã chạy thành công `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web` và `npm run build --workspace @zalobot/web`.
- Kiểm tra trực quan bằng browser tích hợp không thực hiện được vì browser không kết nối được localhost trong môi trường hiện tại.
