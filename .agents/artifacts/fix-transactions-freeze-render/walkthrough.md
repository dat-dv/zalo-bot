# Walkthrough: Sửa lỗi treo render khi vào trang Thu chi (/transactions)

Đã chẩn đoán và khắc phục triệt để lỗi treo render (infinite re-render loop) khiến giao diện bị đóng băng 100% CPU khi người dùng truy cập trang `/transactions`.

## 1. Nguyên nhân cốt lõi đã xử lý

1. **Lỗ hổng equality guard trong `DataTable`:**
   - Trong `DataTable`, 2 `useEffect` đồng bộ cột từ `localStorage` sử dụng dependency là tham chiếu mảng `allColumns`.
   - Mỗi lần `allColumns` thay đổi, `useEffect` gọi `setVisibleColumnIds` và `setColumnWidths` với object/mảng mới ngay cả khi dữ liệu không đổi.
2. **Handlers chưa memoize trong `TransactionsScreen`:**
   - Các hàm (`handleStartEdit`, `handleCancelEdit`, `handleSaveEdit`, `handleDelete`, `setFilter`, `showToast`, `handleCloseAllocate`, `handleAllocateSuccess`) được khởi tạo mới trên mỗi lượt render.
   - Dẫn đến `TransactionsTable` tính lại `columns` -> `DataTable` nhận `allColumns` mới -> `useEffect` gọi `setState` -> tạo vòng lặp render vô tận làm treo Event Loop của trình duyệt.

## 2. Các thay đổi đã thực hiện

### 1. `apps/web/src/shared/ui/data-table.tsx`

- Tạo `allColumnsKey = allColumns.map((c) => c.id).join(',')` làm dependency an toàn cho `useEffect`.
- Thêm equality check trước khi cập nhật `setColumnWidths` và `setVisibleColumnIds`: chỉ `setState` khi dữ liệu thực sự khác với `prev`, giữ nguyên tham chiếu cũ nếu trùng khớp.

### 2. `apps/web/src/modules/dashboard/presentation/components/transactions-screen.tsx`

- Bọc toàn bộ các action handlers và callbacks trong `useCallback`.

### 3. `apps/web/src/shared/hooks/use-period-filter.ts`

- Bọc object kết quả trả về trong `useMemo`.

## 3. Kết quả kiểm thử (Verification)

- **TypeScript (`npm run typecheck`):** 0 lỗi.
- **ESLint (`npm run lint`):** 0 cảnh báo / 0 lỗi.
- **Next.js Production Build (`npm run build --workspace @zalobot/web`):** Build thành công 19/19 static pages trong 526ms.
- **Unit Tests API (`npm run test --workspace @zalobot/api`):** 72/72 tests pass 100%.
- **Agent System Validator (`npm run agent-system:validate`):** Passed 100%.
