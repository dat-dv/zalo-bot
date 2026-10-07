# Kế hoạch sửa lỗi lệch số và hiển thị đầy đủ Cơ cấu chi tiêu trong Analytics

## Hiện trạng & Nguyên nhân gốc rễ (Root Cause)

1. **Lỗi gộp sai chiều dòng tiền ở Backend (`apps/api/src/finance/finance.service.ts`)**:
   - Khi tổng hợp `categoryMap` trong hàm `getAnalyticsReport`:
     ```typescript
     const categoryMap = new Map<
       string,
       { amount: number; count: number; type: 'income' | 'expense' }
     >();
     for (const tx of summary.transactions) {
       const cat = tx.category || 'Khác';
       const existing = categoryMap.get(cat) || { amount: 0, count: 0, type: tx.type };
       existing.amount += tx.amount;
       existing.count += 1;
       categoryMap.set(cat, existing);
     }
     ```
   - Key của `categoryMap` chỉ là tên danh mục `cat`. Khi một người dùng có cả giao dịch **Thu** và **Chi** cùng có danh mục `'Khác'` (hoặc cùng một tên danh mục bất kỳ), giao dịch đến sau sẽ bị cộng dồn vào `existing.amount` nhưng **giữ nguyên `existing.type` của giao dịch đầu tiên**.
   - Cụ thể trong dữ liệu người dùng: Giao dịch chi 550.000 ₫ (danh mục `'Khác'`) đã bị nuốt vào `type: 'income'` do trước đó đã có mục `'Khác'` thuộc Thu. Khi API trả về `categories`, danh mục Chi chỉ còn 3 mục (Ăn uống 227.000 ₫, Đồ uống 168.000 ₫, Ăn vặt 39.000 ₫ = 434.000 ₫).
   - Trong khi đó, `totalExpense` (tính từ `summary.expense`) là 984.000 ₫, dẫn đến **lệch mất 550.000 ₫ (55.9%)** không hiển thị trên biểu đồ và danh sách.

2. **Cắt xén danh mục ở Frontend (`apps/web/src/shared/ui/charts/category-donut-chart.tsx`)**:
   - `CategoryDonutChart` đang dùng `expenseCategories.slice(0, 5)` để chỉ lấy 5 danh mục đầu và gom phần còn lại thành nhãn "Tất cả danh mục", vi phạm nguyên tắc hiển thị toàn vẹn dữ liệu (Full Fidelity) và không đáp ứng yêu cầu "nó phải show hết" của người dùng.

---

## User Review Required

> [!NOTE]
> Sau khi sửa:
>
> - Backend sẽ phân tách độc lập theo key `${tx.type}:${cat}`, đảm bảo 100% tổng số tiền của các danh mục chi tiêu luôn khớp chính xác tuyệt đối với `summary.expense` (984.000 ₫).
> - Frontend sẽ hiển thị đầy đủ tất cả các danh mục chi tiêu (không bị cắt ở top 5), kèm thanh cuộn dọc mượt mà (`max-h-[220px]`) khi người dùng có nhiều danh mục.

---

## Proposed Changes

### 1. Backend (`apps/api`)

#### [MODIFY] [finance.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Sửa key trong `categoryMap` thành `${tx.type}:${cat}` và lưu trường `category: cat`.
- Đảm bảo các giao dịch Thu và Chi có cùng tên danh mục (hoặc cùng là `'Khác'`) được thống kê riêng biệt, tính đúng `percentage` theo `summary.income` hoặc `summary.expense`.

#### [MODIFY] [finance.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.spec.ts)

- Bổ sung unit test kiểm tra `getAnalyticsReport` khi có cả giao dịch Thu và Chi cùng mang danh mục `'Khác'` (hoặc danh mục trùng tên), xác nhận `categories` phân tách đúng `type: 'income'` và `type: 'expense'` với tổng tiền và tỷ lệ phần trăm chuẩn xác.

---

### 2. Frontend Web (`apps/web`)

#### [MODIFY] [category-donut-chart.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/charts/category-donut-chart.tsx)

- Bỏ logic cắt mảng `.slice(0, 5)` và gom nhóm "Tất cả danh mục".
- Render trực tiếp tất cả các danh mục trong `expenseCategories` vào `slices` của Donut Chart và danh sách legend.
- Thêm lớp cuộn dọc `overflow-y-auto max-h-[220px] pr-1` cho khung danh sách danh mục để giao diện luôn gọn gàng và không bị vỡ layout khi có nhiều danh mục.

---

### 3. Đồng bộ Tài liệu Kỹ thuật (`.agents/`)

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md)

- Cập nhật tài liệu Canonical Knowledge: ghi nhận quy tắc phân tách độc lập danh mục theo từng loại giao dịch (`${type}:${category}`) trong báo cáo phân tích.

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md)

- Cập nhật tài liệu tiếng Việt về việc hiển thị đầy đủ 100% cơ cấu chi tiêu trên biểu đồ `/analytics`.

---

## Verification Plan

### Automated Tests

- Chạy unit test backend: `npx tsx --test apps/api/src/finance/finance.service.spec.ts`
- Chạy typecheck monorepo: `npm run typecheck`
- Chạy lint check monorepo: `npm run lint`
- Chạy validate agent system: `npm run agent-system:validate`

### Manual Verification

- Mở trang `/analytics` trên giao diện web.
- Kiểm tra phần "Cơ cấu chi tiêu":
  - Tổng số tiền trên tiêu đề legend ("Top danh mục chi tiêu" hoặc "Danh mục chi tiêu") phải bằng đúng tổng tiền của tất cả các danh mục bên dưới.
  - Tổng phần trăm cộng lại bằng 100%.
  - Khoản 550.000 ₫ (danh mục `'Khác'`) xuất hiện đầy đủ trong danh sách cùng với Ăn uống, Đồ uống, Ăn vặt.
