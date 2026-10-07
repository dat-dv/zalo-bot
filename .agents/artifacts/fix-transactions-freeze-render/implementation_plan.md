# Kế hoạch khắc phục lỗi treo render khi vào trang Thu chi (/transactions)

Tài liệu thiết kế và kế hoạch chi tiết sửa lỗi đóng băng giao diện (freeze / infinite render loop) khi người dùng truy cập trang `/transactions`, khiến người dùng không thể bấm chuyển sang các tab khác.

## Bối cảnh & Nguyên nhân gốc rễ (Root Cause)

1. **Vòng lặp re-render vô tận trong `DataTable`:**
   - Trong [`DataTable`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx#L727-L750), có 2 `useEffect` đồng bộ cấu hình cột (`zalobot:table-columns:${id}`) và độ rộng cột (`zalobot:table-widths:${id}`) từ `localStorage`.
   - Dependency array của 2 effect này là `[allColumns, id]`.
   - Mảng `allColumns` được tính từ `[...systemColumns, ...columns]`.
2. **Handlers chưa memoize trong `TransactionsScreen`:**
   - Trong [`TransactionsScreen`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-screen.tsx), các hàm thao tác (`handleStartEdit`, `handleCancelEdit`, `handleSaveEdit`, `handleDelete`) không được bọc trong `useCallback`.
   - Trên mỗi lượt render, các hàm này tạo ra tham chiếu hàm mới -> `TransactionsTable` re-compute `columns` mới -> `DataTable` nhận `allColumns` mới -> 2 `useEffect` trong `DataTable` chạy lại sau mỗi render -> gọi `setVisibleColumnIds(merged)` và `setColumnWidths(newWidths)` với mảng/object mới -> kích hoạt lượt render tiếp theo.
   - **Kết quả:** Trình duyệt rơi vào vòng lặp re-render 100% CPU liên tục không dừng, làm tê liệt Event Loop của JavaScript trên trình duyệt. Mọi thao tác click chuột trên Sidebar/Navigation bị đóng băng hoàn toàn.

---

## User Review Required

> [!IMPORTANT]
>
> - Cần chuẩn hóa cơ chế so sánh trạng thái trước khi `setState` trong `DataTable` để chặn đứng mọi vòng lặp re-render vô tận.
> - Bọc toàn bộ các action handlers trong `TransactionsScreen` và trả về `useMemo` trong `usePeriodFilter` để đảm bảo hiệu năng và tính ổn định.

---

## Proposed Changes

### 1. Data Table Core Component

#### [MODIFY] [data-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx)

- Sử dụng `allColumnsKey = allColumns.map((c) => c.id).join(',')` làm dependency thay vì tham chiếu mảng `allColumns`.
- Bổ sung kiểm tra tính đồng nhất (equality guard) trước khi gọi `setVisibleColumnIds` và `setColumnWidths`:
  - Nếu danh sách ID cột hoặc độ rộng cột từ `localStorage` trùng khớp với `prev state`, giữ nguyên tham chiếu `prev` và không trigger re-render.

---

### 2. Transactions Screen Component

#### [MODIFY] [transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-screen.tsx)

- Bọc toàn bộ action handlers trong `useCallback`:
  - `setFilter = useCallback(...)`
  - `showToast = useCallback(...)`
  - `handleStartEdit = useCallback(...)`
  - `handleCancelEdit = useCallback(...)`
  - `handleSaveEdit = useCallback(...)`
  - `handleDelete = useCallback(...)`
- Đảm bảo các props truyền xuống `TransactionsTable` luôn giữ tham chiếu ổn định giữa các lần render.

---

### 3. Period Filter Hook

#### [MODIFY] [use-period-filter.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/hooks/use-period-filter.ts)

- Bọc object trả về của `usePeriodFilter` trong `useMemo` để tránh tạo object reference mới liên tục khi state thời gian không thay đổi.

---

## Verification Plan

### Automated Tests

- Chạy kiểm tra TypeScript và Linter:
  ```bash
  npm run typecheck
  npm run lint
  ```
- Chạy toàn bộ test suite:
  ```bash
  npm run test --workspace @zalobot/api
  ```
- Chạy validator hệ thống:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Truy cập vào trang `/transactions`, mở DevTools Console kiểm tra:
  - Component không bị re-render liên tục.
  - CPU trình duyệt ở mức 0–1%.
  - Bấm click chuyển qua lại giữa các tab (`/debts`, `/calendar`, `/tasks`, `/analytics`, `/`) mượt mà, không bị lag hay treo.
