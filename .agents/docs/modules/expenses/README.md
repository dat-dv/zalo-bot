---
metadata:
  agent-artifact:
    id: docs-module-expenses
    type: documentation
    depends_on:
      - .agents/knowledge/modules/expenses/README.md
      - apps/web/src/modules/expenses/api/expenses-api.ts
      - apps/web/src/modules/expenses/api/expenses-query.ts
      - apps/web/src/modules/expenses/presentation/components/expenses-screen.tsx
      - apps/web/app/(private)/expenses/page.tsx
      - apps/web/app/(private)/income/page.tsx
      - apps/api/src/reports/reports.controller.ts
---

# Module chi tiêu (expenses)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/expenses/README.md).

## Trạng thái hiện tại

Module `apps/web/src/modules/expenses` có màn hình lịch sử **khoản chi** riêng (`ExpensesScreen`) và lớp dữ liệu đi kèm, nhưng **màn hình này hiện không được gắn vào route nào**:

- `/expenses` chuyển hướng sang `/transactions?type=expense`.
- `/income` chuyển hướng sang `/transactions?type=income`.

Nghĩa là người dùng xem và sửa khoản chi trong trang Thu chi (`TransactionsScreen`, module dashboard) với bộ lọc loại giao dịch. Module expenses vẫn được giữ lại trong code; query key `['expenses']` vẫn được các mutation giao dịch, nơi chốn, danh bạ làm mới để tương thích.

## API và cache

- `GET /api/expenses`: chỉ lấy khoản chi của người đang đăng nhập, mới nhất trước, **tối đa 200 dòng**, mỗi dòng chỉ có `id`, danh mục, ghi chú, số tiền, ngày phát sinh.
- Sửa và xoá đi qua API giao dịch chung: `PATCH /api/transactions/:id`, `DELETE /api/transactions/:id`.
- Sửa/xoá thành công làm mới cache `expenses`, `transactions`, `dashboard`. Nút Thử lại khi lỗi làm mới `expenses` và `categories`.

## Hành vi của `ExpensesScreen` (nếu được gắn lại)

- Bộ lọc kỳ mặc định theo tháng, thanh chọn kỳ có Tuần / Tháng / Quý / Năm (không có nút "Tất cả"). Lọc kỳ làm ở phía client trên tối đa 200 dòng đã tải.
- Dải xu hướng chi tiêu (`TrendSummaryStrip`) và thẻ đếm số danh mục trong kỳ.
- Lọc theo danh mục (ô chọn chỉ gồm danh mục có trong kỳ) và tìm kiếm theo danh mục/ghi chú.
- Bảng `id="expenses"`: Danh mục, Ghi chú, Số tiền (có thanh tỷ lệ so với khoản lớn nhất trong kỳ), Phương thức thanh toán, Tiền tệ, Ngày phát sinh, Thao tác.
- Sửa trực tiếp danh mục (gợi ý từ danh mục người dùng cấu hình, danh mục đã dùng và danh mục chi mặc định), ghi chú, số tiền (> 0), phương thức thanh toán, ngày phát sinh. Xoá hỏi xác nhận bằng `window.confirm`.
- Số tiền tuân theo chế độ ẩn/hiện số tiền; khi ẩn thì thanh tỉ lệ dưới số tiền cũng ẩn để không lộ khoản lớn/nhỏ; ô nhập khi sửa vẫn hiện số thật.
- **Trên màn hình hẹp (≤ 960px)** bảng chuyển thành danh sách: dòng 1 là ghi chú và số tiền (bị che khi ẩn số tiền, không có thanh tỉ lệ), dòng 2 là danh mục · ngày (dd/MM). Chạm dòng mở bottom-sheet đủ các cột; sửa bằng nút Sửa ở chân sheet vì điện thoại không nhấp đúp được. Trên điện thoại (≤ 640px) ô chọn danh mục và ô tìm kiếm rộng hết màn hình, cao 40px; toast nằm phía trên thanh tab. Giống trang Thu chi để người dùng không phải học hai kiểu thao tác.

## Lỗi/hạn chế đã biết

- Cột Phương thức thanh toán và Tiền tệ luôn hiện "chưa đặt"/`VND` vì `GET /api/expenses` không trả hai trường này (dù entity và API sửa giao dịch có hỗ trợ `paymentMethod`).
- Giới hạn 200 dòng: các kỳ cũ hơn 200 khoản chi gần nhất sẽ hiện rỗng.

Nếu muốn dùng lại màn hình này, cần bổ sung trường vào API và quyết định lại route trước khi gắn.

## Màu nút ở dark mode

- Ở dark mode, nút hành động chính dùng tông xanh sky (`dark:bg-sky-600 dark:text-white`), không dùng kiểu đảo màu `dark:bg-slate-100` vì nó thành khối trắng chói trên nền tối. Trong module này áp dụng cho nút chính (lưu) trong dòng của `ExpensesScreen`; toast dùng tông toast tối. Light mode giữ nút đen như cũ. Xem [web-ui-direction](../../global/web-ui-direction.md).
