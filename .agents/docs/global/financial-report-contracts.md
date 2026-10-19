---
metadata:
  agent-artifact:
    id: docs-global-financial-report-contracts
    type: documentation
    depends_on:
      - .agents/knowledge/global/financial-report-contracts.md
      - apps/api/src/reports/reports.controller.ts
---

# Hợp đồng báo cáo tài chính

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`financial-report-contracts.md`](../../knowledge/global/financial-report-contracts.md).

Hai endpoint báo cáo (trong `ReportsController`) dùng contracts tập trung trong `packages/contracts/src/index.ts` và trả về dạng `{ data: ... }`:

- `GET /api/debts?status=active|settled`: trả `IDebtListItem[]`, tối đa 200 khoản nợ, mới nhất trước. Không truyền `status` thì trả **cả nợ đang mở và đã tất toán**. Lưu ý: endpoint không lọc khoản nợ con, nên một khoản nợ con xuất hiện vừa ở cấp ngoài cùng vừa trong `children` của khoản nợ cha — giao diện cần tự loại trùng nếu chỉ muốn hiển thị cây. Mỗi mục kèm lịch sử `payments` và `childCount`.
- `GET /api/expenses`: trả `IExpenseListItem[]` cho tối đa 200 khoản chi mới nhất. Thực tế chỉ có các trường `id`, `category`, `note`, `amount`, `occurredAt`; các trường tuỳ chọn khác trong contract (`paymentMethod`, `currency`...) không được điền.

Cả hai endpoint xác thực bằng access token dashboard và luôn lọc theo người dùng trong token. Không dùng các endpoint này để thay đổi công nợ hoặc giao dịch; quy tắc nghiệp vụ xem [Nghiệp vụ tài chính](finance-domain.md).
