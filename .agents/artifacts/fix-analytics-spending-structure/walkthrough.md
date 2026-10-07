# Walkthrough: Sửa lỗi lệch số và hiển thị đầy đủ Cơ cấu chi tiêu trong Analytics

Chúng tôi đã khắc phục triệt để hiện tượng lệch số tiền và thiếu danh mục trên biểu đồ "Cơ cấu chi tiêu" (Spending Distribution) của trang `/analytics`.

## Nguyên nhân gốc rễ và Khắc phục

### 1. Backend (`apps/api/src/finance/finance.service.ts`)

- **Lỗi cũ**: Hàm `getAnalyticsReport` gom nhóm `categoryMap` chỉ bằng key `cat` (tên danh mục). Khi người dùng có cả giao dịch Thu và Chi có danh mục `'Khác'` (hoặc danh mục trùng tên), giao dịch đến sau bị cộng dồn số tiền nhưng giữ nguyên `type` của giao dịch đầu tiên. Điều này khiến khoản chi 550.000 ₫ danh mục `'Khác'` bị gán nhầm thành `type: 'income'` và bị Frontend lọc bỏ khỏi `expenseCategories`, gây thiếu 550.000 ₫ (55.9%) so với `totalExpense` (984.000 ₫).
- **Khắc phục**: Chuyển key `categoryMap` thành `${tx.type}:${cat}`, phân lập rạch ròi 100% giữa Thu và Chi. Đảm bảo tổng số tiền và phần trăm của các danh mục chi tiêu luôn khớp chính xác tuyệt đối với `summary.expense`.
- **Unit test**: Bổ sung kiểm thử tự động trong `finance.service.spec.ts` kiểm chứng việc phân tách độc lập danh mục khi Thu và Chi trùng tên danh mục.

### 2. Frontend (`apps/web/src/shared/ui/charts/category-donut-chart.tsx`)

- **Khắc phục**: Loại bỏ logic cắt mảng `slice(0, 5)` và gom nhóm "Tất cả danh mục".
- Render trực tiếp toàn bộ các danh mục chi tiêu trong `expenseCategories` vào biểu đồ Donut và danh sách legend.
- Thêm thuộc tính cuộn dọc `max-h-[220px] overflow-y-auto pr-1` cho danh sách legend để đảm bảo giao diện luôn gọn gàng và không bị vỡ layout khi có nhiều danh mục.

### 3. Đồng bộ Tài liệu Kỹ thuật (`.agents/`)

- [Canonical Knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/finance/README.md) & [Developer Docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/finance/README.md): Cập nhật quy chuẩn gom nhóm `${type}:${category}` và hiển thị 100% cơ cấu chi tiêu trên Analytics.

---

## Kết quả Kiểm thử & Xác minh

| Kiểm thử                                                         | Kết quả       | Chi tiết                                                           |
| :--------------------------------------------------------------- | :------------ | :----------------------------------------------------------------- |
| **Backend Unit Tests** (`npm run test --workspace @zalobot/api`) | ✅ Thành công | 79/79 tests passed, bao gồm test case phân tách danh mục           |
| **Typecheck** (`npm run typecheck`)                              | ✅ Thành công | 0 lỗi TypeScript trên toàn bộ Monorepo (`api`, `web`, `contracts`) |
| **Lint** (`npm run lint`)                                        | ✅ Thành công | 0 lỗi ESLint                                                       |
| **Agent System Validate** (`npm run agent-system:validate`)      | ✅ Thành công | 91 artifacts, 157 dependencies, 0 cyclic groups                    |
