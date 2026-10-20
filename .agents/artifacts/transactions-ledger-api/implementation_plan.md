# Kế hoạch: API danh sách giao dịch theo kỳ + số dư sổ cái thật

- Route: `implement` · Phase 1 (inspect-and-plan) · Rủi ro: **MEDIUM** (API + contracts + web, không đổi DB schema)
- Ngày: 2026-10-20 · Base: `main` @ `a828228`

## 1. Hiện trạng (đã xác minh trong code)

| Vấn đề | Bằng chứng |
| --- | --- |
| Trang Transactions lấy dữ liệu từ `/api/dashboard`, chỉ có **20 giao dịch mới nhất của tháng hiện tại** | `reports.controller.ts:112-161` (`getSummary(tháng này)` → `.slice(0, 20)`); `transactions-screen.tsx:64,85` |
| Chọn tuần/quý/năm hoặc lùi kỳ → lọc client trên 20 dòng đó → trống/sai | `transactions-screen.tsx:132-134` (`isItemInPeriod`) |
| Số dư lũy kế tính từ 0 trên 20 dòng đó, không phải số dư ví thật | `transactions-screen.tsx:88-108` |
| `AdjustBalanceModal` dùng `finance.balance` = thu − chi **tháng này** làm "số dư trên sổ" → số tiền cân chỉnh sai | `transactions-screen.tsx:388`, `settings-screen.tsx:508`, `dashboard-home-screen.tsx:462` |
| `GET /api/transactions` đã tồn tại nhưng chỉ lọc `type`, trả entity thô, cắt cứng 200 dòng, web không dùng | `finance.controller.ts:67-71`, `finance.service.ts:526-544` |

## 2. Thiết kế

### 2.1 Contracts (`packages/contracts/src/index.ts`)
- `ITransactionListQuery { type?: TransactionType; startAt?: string; endAt?: string; search?: string; limit?: number; offset?: number }`
- `ITransactionListItem extends ITransactionItem { runningBalance: number }` — số dư ví **sau** giao dịch đó, tính trên toàn bộ sổ của user (không phụ thuộc bộ lọc).
- `ITransactionListResponse { items: ITransactionListItem[]; total: number; limit: number; offset: number; summary: { income: number; expense: number; count: number }; ledgerBalance: number }`
  - `summary` tính trên **toàn bộ** kết quả lọc theo kỳ (bỏ qua `type`/`search` để dải tổng hợp luôn hiện cả thu và chi của kỳ), không phụ thuộc phân trang.
  - `ledgerBalance` = tổng thu − tổng chi toàn thời gian.
- Thêm `ledgerBalance: number` vào `finance` của payload dashboard (giữ nguyên `balance` theo tháng để không phá Home).
- Không thêm route mới: vẫn dùng `API_ROUTES.transactions`.

### 2.2 Backend (`apps/api/src/finance`)
- `FinanceService.queryTransactions(userId, query)` (method mới; **giữ nguyên** `listTransactions` vì `delete-transaction-tool.strategy.ts:62` đang dùng):
  - Lọc `userId`, `occurredAt` trong `[startAt, endAt]`, `type`, `search` (ILIKE trên `category`, `note`, `place.name`).
  - Sắp xếp `occurredAt DESC, createdAt DESC, id DESC`; `limit` mặc định 100, tối đa 500; `offset` ≥ 0.
  - `runningBalance`: một truy vấn SQL dùng window function `SUM(CASE type WHEN 'income' THEN amount ELSE -amount END) OVER (ORDER BY occurred_at, created_at, id)` trên toàn bộ giao dịch của user, rồi ghép theo id cho các dòng của trang hiện tại.
  - `summary` và `ledgerBalance`: truy vấn aggregate `SUM` (không load entity).
  - Map entity → `ITransactionListItem` (cùng shape với mapper đang dùng trong dashboard: place, allocations…). Tách mapper dùng chung `toTransactionItem` để dashboard và endpoint mới không lệch nhau.
- `FinanceController GET transactions`: parse/validate query (ngày ISO hợp lệ, `limit`/`offset` số nguyên, `type` thuộc enum) → `BadRequestException` khi sai. Response `{ data: ITransactionListResponse }`.
  - **Thay đổi tương thích**: response cũ là mảng entity; đã kiểm tra web không gọi `GET /api/transactions` nên an toàn.
- `ReportsController.dashboard`: thêm `finance.ledgerBalance` (dùng cùng hàm aggregate).

### 2.3 Web (`apps/web/src/modules/dashboard`)
- `api/transactions-api.ts`: `listTransactions(query, signal)`.
- `api/transactions-query.ts`: query key factory `transactionsQueryKeys.list(query)`; `useTransactionsInfiniteQuery(query)` (`useInfiniteQuery`, trang 100 dòng, `getNextPageParam` theo `offset + items.length < total`). Các mutation hiện tại đã invalidate `['transactions']` → giữ, chuyển sang dùng factory.
- `transactions-screen.tsx`:
  - Lấy `startDate/endDate` từ `usePeriodFilter`, `type` từ `?type=`, `search` (debounce 300ms) → gọi query mới thay vì `dashboard.data.transactions`.
  - Bỏ tính running balance phía client; dùng `runningBalance` từ server.
  - `TrendSummaryStrip`: tổng thu/chi lấy từ `summary` (chính xác cho cả kỳ); `buckets` vẫn sinh từ các dòng đã tải. Nếu kỳ có > số dòng đã tải, hiển thị nút **"Tải thêm"** cuối bảng (i18n key mới `table.loadMore`, `table.loadedOf`).
  - Trạng thái loading/error/empty dựa trên query mới; vẫn dùng `useDashboardQuery` chỉ để lấy `ledgerBalance`… → thay bằng `ledgerBalance` trong response list (không cần dashboard nữa trên trang này).
- `AdjustBalanceModal` callers: `currentBalance` = `ledgerBalance` (Transactions từ list response; Settings và Home từ `dashboard.finance.ledgerBalance`).

### 2.4 Ngoài phạm vi
- Metric "Số dư" trên Home giữ nghĩa thu − chi của tháng (chỉ đổi nguồn cho modal cân chỉnh).
- Không thêm phân trang dạng số trang cho `DataTable` dùng chung (dùng "Tải thêm").
- `ExpensesScreen` (không được route) không sửa.

## 3. Kiểm thử
- `finance.service.spec.ts`: lọc theo kỳ/type/search; `runningBalance` đúng khi có giao dịch trước kỳ và khi lọc `type`; `summary`/`ledgerBalance`; giới hạn `limit` tối đa; phân quyền theo user.
- `finance.controller` spec: query không hợp lệ → 400.
- Web: test `transactions-api` gửi đúng query params qua `API_ROUTES.transactions`.
- Chạy: `npm run typecheck`, `npm run test`, `npm run lint` (báo riêng lỗi lint có sẵn), `npm run build --workspace @zalobot/web`.
- Kiểm tra thủ công (nếu chạy được local): đổi kỳ tháng trước/quý/năm, lọc thu/chi, tìm kiếm, "Tải thêm", số trong modal cân chỉnh = số dư sổ cái.

## 4. Tài liệu (Hard Completion Gate)
- `knowledge/modules/dashboard` + `docs/modules/dashboard`: nguồn dữ liệu Transactions, running balance từ server, "Tải thêm", ledgerBalance cho modal; xoá ghi chú known-issue tương ứng.
- `knowledge/global/finance-domain.md`, `global/backend-crud-api.md`, `global/financial-report-contracts.md` (+ bản VI): contract `GET /api/transactions` mới và `finance.ledgerBalance`.
- Cập nhật `.agents/artifacts/sync-docs-with-code-2026-10/walkthrough.md` mục 8 → đã xử lý.
- `node .claude/hooks/docs-drift-check.mjs --all` exit 0; ghi `walkthrough.md` cho task này.

## 5. Cần anh duyệt
1. Đồng ý đổi response `GET /api/transactions` sang dạng `{ items, total, summary, ledgerBalance }` (web hiện không dùng endpoint này)?
2. Dùng nút "Tải thêm" (trang 100 dòng) thay vì phân trang số trang?
3. Giữ metric "Số dư" trên Home theo tháng (chỉ modal cân chỉnh dùng số dư sổ cái)?
