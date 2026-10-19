---
metadata:
  agent-artifact:
    id: docs-module-debts
    type: documentation
    depends_on:
      - .agents/knowledge/modules/debts/README.md
      - apps/web/src/modules/debts/api/debts-api.ts
      - apps/web/src/modules/debts/api/debts-query.ts
      - apps/web/src/modules/debts/presentation/components/debts-screen.tsx
      - apps/web/src/modules/debts/presentation/components/debts-table.tsx
      - apps/web/src/modules/debts/presentation/components/combine-debts-dialog.tsx
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/finance/finance.service.ts
      - packages/contracts/src/index.ts
---

# Module công nợ (debts)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/debts/README.md).

## Vai trò nghiệp vụ

Trang `/debts` cho người dùng theo dõi **khoản phải thu** (người khác nợ mình) và **khoản phải trả** (mình nợ người khác), cả đang mở lẫn đã tất toán. Khoản nợ chỉ hoàn tất khi **số còn lại** bằng 0. Người dùng có thể sửa nhanh, trả hết một khoản, xem lịch sử các đợt trả và gộp nhiều khoản nợ thành một khoản nợ cha.

## API và cache

- `GET /api/debts`: trả khoản nợ của người đang đăng nhập, sắp theo ngày phát sinh mới nhất → ngày tạo → id (giảm dần), **tối đa 200 bản ghi**, kèm danh sách đợt trả và khoản con. API hỗ trợ `?status=active|settled` nhưng web không dùng — lọc trạng thái làm ở phía client.
- Khoản nợ thiếu `occurredAt` (dữ liệu cũ) dùng `createdAt` thay thế.
- Khoản con xuất hiện cả như một bản ghi riêng (có `parentDebtId`); bảng chỉ hiện khoản gốc/khoản cha, còn khoản con nằm trong panel mở rộng của khoản cha.
- Mọi mutation (sửa, trả nợ, xoá đợt trả, gộp) làm mới cache `debts` và `dashboard`. Nút Thử lại trên màn hình làm mới `debts` và `contacts`.

## Màn hình công nợ

- Tiêu đề trang do `WorkspaceHeader` của layout chung hiển thị.
- **Thẻ KPI**: tổng phải thu và tổng phải trả đang mở (chỉ tính khoản gốc để không cộng trùng khoản con), tuân theo chế độ ẩn/hiện số tiền.
- **Bộ lọc**: trạng thái (Tất cả / Đang mở / Đã tất toán, có số đếm), chiều nợ (Tất cả / Cho vay / Đi vay), tìm kiếm theo người liên quan, biệt danh, ghi chú (tìm cả trong khoản con).
- **Bảng** (`DebtsTable`, `id="debts"`): chọn, Trạng thái, Chiều nợ, Người liên quan (có nút mở rộng ▶/▼), Số tiền gốc, Số còn lại (thanh tiến độ nhỏ + tooltip khi đã trả một phần), Tiền tệ, Hạn trả, Ngày tất toán, Ghi chú, Thao tác. Các cột Trạng thái, Người liên quan, Số còn lại, Thao tác không ẩn được.
- **Sửa trực tiếp** (nhấp đúp hoặc ✎, `Enter`/`Escape`): chiều nợ, người liên quan (gợi ý từ danh bạ công nợ), số tiền gốc, số còn lại, ghi chú, hạn trả. Ngày phát sinh hiện **không** sửa được trên giao diện (API vẫn hỗ trợ).
- **Trả nhanh (+)**: chỉ có ở khoản đang mở, luôn trả **toàn bộ** số còn lại.
- **Panel mở rộng**: bảng nhỏ các khoản con và bảng lịch sử đợt trả (số tiền, ngày, ghi chú, biểu tượng 🔗 nếu đợt trả đến từ phân bổ giao dịch, nút xoá). Xoá đợt trả có hộp `window.confirm` xác nhận.
- **Gộp nợ**: chọn từ 2 khoản gốc → `CombineDebtsDialog` (ghi chú, hạn trả). Nếu chọn lệch chiều nợ hoặc lệch loại tiền, dialog báo lỗi và khoá nút xác nhận.
- Không có nút xoá khoản nợ trên giao diện. Trang chủ dùng lại `DebtsTable` ở chế độ chỉ đọc.

## Quy tắc nghiệp vụ phía backend

- **Sửa số còn lại**: về 0 thì chuyển `settled` và ghi ngày tất toán; lớn hơn 0 thì mở lại.
- **Ghi nhận đợt trả** (`POST /api/debts/:id/payments`, một transaction): khoản nợ phải đang mở và số trả không vượt số còn lại. Hệ thống đồng thời tạo một giao dịch thu–chi để số dư dòng tiền khớp với công nợ: thu hồi khoản **phải thu** → khoản **thu** danh mục _Thu hồi nợ_; trả khoản **phải trả** → khoản **chi** danh mục _Trả nợ_.
- **Xoá đợt trả** (một transaction): cộng lại số còn lại (không vượt số gốc), mở lại khoản nợ, tính lại số còn lại của khoản cha, và xoá giao dịch liên kết **nếu** đợt trả có `financeTransactionId` (tức là đợt trả sinh ra từ phân bổ giao dịch).
- **Phân bổ giao dịch vào nợ**: một giao dịch thu/chi có sẵn có thể được phân bổ vào một hoặc nhiều khoản nợ qua `/api/transactions/:id/allocations` (xem module dashboard); mỗi phân bổ sinh một đợt trả có `financeTransactionId`.
- **Gộp nợ** (`POST /api/debts/combine`, một transaction): cần ít nhất 2 khoản của chính người dùng, cùng chiều và cùng loại tiền. Tạo khoản cha có số gốc và số còn lại bằng tổng các khoản con; khoản con trỏ về cha qua `parentDebtId`. Nếu khoản được gộp đã có con, các con đó được chuyển thẳng lên cha mới để cây luôn chỉ có một cấp.
- Gộp danh bạ có chọn "gom nợ" sẽ tái sử dụng logic gộp nợ theo từng nhóm chiều + loại tiền (xem module contacts).

## Lỗi đã biết (chưa sửa)

- **Nút Trả nhanh không hoạt động**: web gọi `POST /api/debts/payments` (`API_ROUTES.debtPayments`) nhưng backend chỉ có `POST /api/debts/:id/payments`, nên nhận 404. Cần một task riêng để sửa route (client hoặc contract).
- Đợt trả tạo qua `POST /api/debts/:id/payments` không lưu `financeTransactionId`, nên khi xoá đợt trả đó, giao dịch _Thu hồi nợ_/_Trả nợ_ tự sinh vẫn còn trong sổ thu–chi.
- Danh sách giới hạn 200 bản ghi (tính cả khoản con), chưa phân trang.

## Kiểm thử

`npm run typecheck`, `npm run lint`, `npm run build` (scope `--workspace @zalobot/web`); test backend liên quan chạy bằng `npm run test --workspace @zalobot/api`.
