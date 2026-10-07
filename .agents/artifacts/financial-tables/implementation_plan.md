---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch: các bảng Contacts, công nợ và chi

## Mục tiêu

Mở rộng khu vực báo cáo để có ba màn hình bảng riêng, dùng dữ liệu tài chính hiện có:

1. **Contacts**: danh bạ công nợ.
2. **Nợ ai thu ai**: các khoản công nợ đang mở, phân biệt “cần thu” và “cần trả”.
3. **Chi**: lịch sử các giao dịch có loại `expense`.

## Hiện trạng đã xác nhận

- CSDL SQLite đã có các bảng/entity `debt_contacts`, `debts`, và `finance_transactions`; không cần tạo schema mới.
- Dashboard hiện chỉ hiển thị tối đa một phần giao dịch và công nợ trong trang Thống kê; Contacts đã có một trang riêng.
- API báo cáo hiện có `/contacts` và `/dashboard`, nhưng chưa có endpoint chuyên biệt cho danh sách công nợ và chi.
- `FinanceService` đã bảo đảm dữ liệu được cô lập theo `userId`.

## Phạm vi thực hiện đề xuất

### Hợp đồng và API

- Bổ sung route hợp đồng cho `debts` và `expenses`, cùng các kiểu item/response tương ứng trong `packages/contracts/src/index.ts`.
- Thêm hai endpoint báo cáo đã xác thực:
  - `GET /debts`: trả toàn bộ khoản nợ đang mở của người dùng, gồm chiều công nợ, người liên quan, số tiền gốc/còn lại, ghi chú, hạn trả và ngày tạo.
  - `GET /expenses`: trả các giao dịch loại `expense` của người dùng, mới nhất trước, gồm danh mục, ghi chú, số tiền và ngày phát sinh.
- Mở rộng `FinanceService` bằng các hàm truy vấn riêng có kiểm soát theo `userId`; giữ nguyên dữ liệu và hành vi zalo hiện tại.

### Giao diện

- Tạo các module web `debts` và `expenses` theo cấu trúc đang dùng ở `contacts`: API client, TanStack Query và màn hình hiển thị.
- Thêm hai trang `/reports/debts/` và `/reports/expenses/`.
- Mở rộng thanh điều hướng cho cả ba bảng: Liên lạc, Công nợ, Khoản chi.
- Các cột đề xuất:
  - **Contacts**: Tên, biệt danh, mô tả, ngày tạo (giữ nguyên).
  - **Công nợ**: Hướng (cần thu/cần trả), người liên quan, số nợ gốc, còn lại, hạn thanh toán, ghi chú.
  - **Khoản chi**: Danh mục, nội dung chi, số tiền, ngày phát sinh.
- Dùng `DataTable` hiện có để giữ trạng thái tải/rỗng/lỗi và cuộn ngang trên điện thoại; tiền tệ hiển thị VND và hướng công nợ dùng nhãn tiếng Việt rõ ràng.

### Tài liệu

- Cập nhật knowledge tiếng Anh và hướng dẫn tiếng Việt cho các module bị ảnh hưởng; cập nhật chỉ mục `.agents/docs/README.md` nếu có trang/module mới.

## Tệp dự kiến ảnh hưởng

- `packages/contracts/src/index.ts`
- `apps/api/src/finance/finance.service.ts`
- `apps/api/src/reports/reports.controller.ts`
- `apps/web/src/modules/dashboard/view/dashboard-screen.tsx`
- `apps/web/src/modules/contacts/view/contacts-screen.tsx`
- `apps/web/src/modules/debts/**` (mới)
- `apps/web/src/modules/expenses/**` (mới)
- `apps/web/app/reports/debts/page.tsx` (mới)
- `apps/web/app/reports/expenses/page.tsx` (mới)
- Tài liệu dưới `.agents/knowledge/` và `.agents/docs/`

## Kiểm thử sau khi triển khai

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Kiểm tra thủ công các trạng thái tải, rỗng, lỗi và dữ liệu của từng bảng với một phiên dashboard hợp lệ.

## Giả định cần xác nhận

- “Table nợ ai thu ai” được hiểu là danh sách các khoản **công nợ đang mở**, với “cần thu” và “cần trả” nằm chung một bảng và có nhãn phân biệt.
- “Table chi” chỉ gồm các giao dịch `expense`; không đưa giao dịch thu vào bảng này.
- Giai đoạn này chỉ hiển thị/lọc danh sách, không bổ sung thao tác sửa, xóa hay thanh toán trực tiếp trên web.

## Kết quả triển khai

- Đã thêm `GET /api/debts` và `GET /api/expenses`, cả hai đều xác thực và giới hạn dữ liệu theo người dùng trong access token dashboard.
- Đã thêm các trang `/reports/debts` và `/reports/expenses`, đồng thời bổ sung điều hướng đến Contacts, Công nợ và Khoản chi.
- Đã chạy thành công build contracts, typecheck, lint và build toàn bộ workspace.
