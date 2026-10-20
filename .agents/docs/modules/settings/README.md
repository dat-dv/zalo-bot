---
metadata:
  agent-artifact:
    id: docs-module-settings
    type: documentation
    depends_on:
      - .agents/knowledge/modules/settings/README.md
      - apps/web/src/modules/settings/api/categories-api.ts
      - apps/web/src/modules/settings/api/categories-query.ts
      - apps/web/src/modules/settings/presentation/components/settings-screen.tsx
      - apps/web/src/shared/providers/react-scan-provider.tsx
---

# Module Cài Đặt & Danh Mục

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/settings/README.md).

Module `apps/web/src/modules/settings` cho phép người dùng quản lý danh mục thu/chi của riêng mình và xem một số tuỳ chọn của dashboard.

## 1. Vì sao cần quản lý danh mục

Danh mục (ví dụ `Ăn uống`, `Lương`) dùng để nhóm giao dịch trong báo cáo. Người dùng tự đặt danh mục để báo cáo phản ánh đúng thói quen chi tiêu của họ. Giao dịch lưu **tên** danh mục, nên đổi tên hay xoá danh mục không xoá giao dịch cũ.

## 2. Cấu trúc mã nguồn

- `api/categories-api.ts`: `getCategories` (có thể lọc `?type=income|expense`), `createCategory`, `updateCategory`, `deleteCategory`, đều gọi `API_ROUTES.categories`.
- `api/categories-query.ts`: query key `['categories']` và 4 hook TanStack Query. Mọi mutation thành công đều làm mới `categoriesQueryKeys.all`.
- `presentation/components/settings-screen.tsx`: màn hình `SettingsScreen` (re-export qua `view/settings-screen.tsx`).
- Endpoint backend nằm trong `apps/api/src/finance/finance.controller.ts`.

## 3. Màn hình Cài đặt

Tiêu đề trang, nút Làm mới và Đăng xuất do `WorkspaceHeader` của layout chung cung cấp; `SettingsScreen` không tự vẽ header. Màn hình có 2 tab:

- **Danh mục** (mặc định): hai bảng `DataPanel` cho danh mục chi và danh mục thu.
  - Tìm kiếm theo tên.
  - Thêm nhanh: bấm nút thêm, gõ tên, `Enter` để lưu, `Escape` để huỷ.
  - Đổi tên: nhấp đúp hoặc bấm Sửa, `Enter`/`Escape` như trên.
  - Xoá có hộp thoại xác nhận.
  - Các nút thao tác dùng `flex-nowrap whitespace-nowrap` và `shrink-0` để không rớt dòng khi chuyển giữa chế độ xem/sửa.
  - Có trạng thái đang tải, rỗng và lỗi (kèm nút Thử lại).
- **Tuỳ chọn**:
  - Ngôn ngữ và Giao diện Sáng/Tối: chỉ là dòng thông tin kèm nhãn "Đã hỗ trợ", không có công tắc đổi ở đây.
  - **Quản lý số dư & Cân chỉnh ví**: nút `⚖️` mở `AdjustBalanceModal` (thuộc module dashboard) để cân số dư sổ sách với số dư ví thật. Số dư trên sổ lấy từ `finance.ledgerBalance` của payload dashboard (tổng thu − tổng chi toàn thời gian), không phải số dư của tháng.
  - Công tắc **React Scan**.

## 4. React Scan — giới hạn đã biết

- `ReactScanProvider` (`apps/web/src/shared/providers/react-scan-provider.tsx`) chỉ lưu cờ bật/tắt vào localStorage với khoá `zalobot-react-scan-enabled` (mặc định tắt).
- Hiện **không có chỗ nào nạp thư viện `react-scan`** dù package có trong `apps/web/package.json`. Vì vậy bật công tắc này chưa có tác dụng gì. Muốn dùng thật cần một task riêng để nạp profiler khi cờ được bật.

## 5. Kiểm thử

Chạy `npm run typecheck`, `npm run lint` và `npm run build` tại thư mục gốc. Thử tay: thêm, đổi tên, xoá danh mục ở cả hai bảng; mở tab Tuỳ chọn và bấm nút cân chỉnh số dư.
