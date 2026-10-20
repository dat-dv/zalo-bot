# Walkthrough: Filter trên header bảng Thu chi

Plan: [implementation_plan.md](implementation_plan.md). Anh duyệt bằng "triển khai cho a đi", không trả lời 4 câu hỏi mở nên em áp dụng các lựa chọn đề xuất:
1. Cột Hướng: header dùng chung `?type=` với nút Thu/Chi trên toolbar.
2. `summary` không đổi theo bộ lọc cột.
3. Không lọc theo Số dư lũy kế.
4. Bộ lọc lưu trên URL.

Khác so với plan: thêm `facets.categories` (danh mục là text tự do, nếu chỉ lấy danh mục đã cấu hình sẽ thiếu). Gửi danh sách dạng lặp key thay vì CSV để danh mục có dấu phẩy không bị tách sai.

## Thay đổi
- `packages/contracts`: thêm field mới vào `ITransactionListQuery`, thêm `TRANSACTION_FILTER_NO_PLACE`, `ITransactionCreatorFacet`, `ITransactionListResponse.facets`, i18n `table.columnFilter.*` (vi/en).
- API `finance.controller.ts`: parse và validate tham số mới, sai thì trả 400. `finance.service.ts`: thêm điều kiện where (`In`, `ILike`, `Raw` cho receipt, `Between` cho số tiền, nhánh OR cho "không có nơi chốn", `And` khi bộ lọc cột trùng cột với search). Facets lấy từ cùng lần đọc ledger rows, không thêm query giao dịch.
- Web: `transaction-column-filters.ts` (state, URL, query), `column-filter-popover.tsx` (header và các panel lọc), `transactions-table.tsx` (header có bộ lọc), `transactions-screen.tsx` (state lấy từ URL, nút xoá tất cả bộ lọc), `transactions-api.ts` (`paramsSerializer`).
- Docs: knowledge `modules/dashboard`, `global/finance-domain`, `global/backend-crud-api`; docs `modules/dashboard`, `global/finance-domain`.

## Kiểm chứng
- `npm run test`: api 381/381, web 30/30 (gồm test mới cho controller, service và URL round-trip).
- `npm run typecheck`: 0 lỗi. `eslint` trên `apps/api/src/finance` và `apps/web/src/modules/dashboard`: sạch. Lint toàn repo vẫn còn lỗi có sẵn từ trước ở file khác, không liên quan đến task này.
- `npm run build --workspace @zalobot/web`: OK.
- In SQL TypeORM bằng DataSource offline: điều kiện `IN`, `ILIKE`, `NULLIF(TRIM(receipt_url),'')`, `BETWEEN`, `IS NULL` đúng như mong đợi.
- `docs-drift-check`: PASS.
- **Chưa kiểm**: chưa chạy với Postgres thật và chưa thử giao diện trên trình duyệt, vì máy local không có DB đang chạy.
