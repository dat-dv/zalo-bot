# Walkthrough: API danh sách giao dịch theo kỳ + số dư sổ cái (2026-10-20)

## Kết quả
- `GET /api/transactions` nay lọc theo kỳ (`startAt`/`endAt`), loại, từ khoá (danh mục, ghi chú, tên nơi chốn), phân trang `limit` (mặc định 100, tối đa 500) + `offset`. Trả về `ITransactionListResponse { items, total, limit, offset, summary, ledgerBalance }`.
- Mỗi dòng có `runningBalance` = số dư ví sau giao dịch, tính trên toàn bộ sổ (không phụ thuộc bộ lọc).
- Payload dashboard có thêm `finance.ledgerBalance`; `finance.balance` (theo tháng) giữ nguyên.
- Trang Thu chi dùng `useTransactionsInfiniteQuery` (lọc ở server, nút "Tải thêm", `keepPreviousData`), không còn đọc `/api/dashboard`.
- `AdjustBalanceModal` ở Thu chi / Trang chủ / Cài đặt dùng số dư sổ cái thật.

## File thay đổi
- Contracts: `ITransactionListQuery`, `ITransactionListItem`, `ITransactionListResponse`, `IDashboardData.finance.ledgerBalance`, i18n `table.loadMore`, `table.loadedOf` (vi/en).
- API: `finance/transaction-item.mapper.ts` (mới, dùng chung với dashboard), `finance.service.ts` (`computeLedger`, `getLedgerBalance`, `queryTransactions`), `finance.controller.ts` (parse/validate query), `reports/reports.controller.ts` (ledgerBalance + mapper).
- Web: `dashboard/api/transactions-api.ts`, `transactions-query.ts`, `transactions-screen.tsx`, `dashboard-home-screen.tsx`, `settings/.../settings-screen.tsx`.
- Tests: `finance/finance-transactions-query.spec.ts` (5 test), `dashboard/api/transactions-api.spec.ts` (1 test).
- Docs: dashboard, settings (module), finance-domain, backend-crud-api (global) — EN + VI; đánh dấu mục 8 trong walkthrough sync-docs là đã xử lý.

## Khác so với plan
- Số dư lũy kế tính bằng hàm thuần `computeLedger` trên các dòng nhẹ (id/type/amount/occurredAt/createdAt) của toàn bộ sổ thay vì window function SQL: cùng kết quả, test được với repository mock, không phụ thuộc dialect. Với sổ cá nhân (vài nghìn dòng) chi phí không đáng kể; nếu sau này sổ rất lớn có thể chuyển sang SQL.

## Xác minh
- `npm run typecheck`: pass.
- `npm run test`: API 360/360, web 23/23.
- `eslint` trên các file đã sửa: pass.
- `npm run build --workspace @zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS.
- **Chưa kiểm tra thủ công trên app đang chạy** (đổi kỳ, Tải thêm, số dư trong modal).

## Hạn chế còn lại
- Biểu đồ cột trong dải xu hướng chỉ phản ánh các dòng đã tải khi kỳ có > 100 giao dịch (tổng thu/chi vẫn chính xác từ `summary`).
- Bảng Giao dịch và thẻ "Số dư" trên trang chủ vẫn theo tháng hiện tại (chủ đích).
