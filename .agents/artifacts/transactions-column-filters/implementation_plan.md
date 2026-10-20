# Kế hoạch: Filter trên header bảng Thu chi (lọc phía backend)

- Route: `implement` · Phase 1 (Planning) · Risk: **MEDIUM** (đổi contract `ITransactionListQuery`, API `GET /api/transactions`, UI bảng)
- Skills: `backend`, `backend-bridge-frontend`, `frontend-orchestration`, `tanstack-query`, `enterprise-ui`

## 1. Hiện trạng

- `GET /api/transactions` (`apps/api/src/finance/finance.controller.ts:140`) nhận `type`, `startAt`, `endAt`, `search`, `limit`, `offset`; `FinanceService.queryTransactions` (`finance.service.ts:638`) build `where` bằng TypeORM `FindOptionsWhere`, `search` OR trên `category` / `note` / `place.name`.
- Web: `TransactionsScreen` dựng `listQuery` → `useTransactionsInfiniteQuery` (query key chứa toàn bộ filter, `keepPreviousData`). Toolbar đã có nút Tất cả/Thu/Chi (đồng bộ URL `?type=`) và ô search chung.
- `DataTableColumn.header` là `ReactNode` → có thể gắn nút filter vào header như `ReceiptColumnHeader` đang làm, không cần sửa `DataTable` core.
- Lưu ý: `transactions-table.tsx`, `transaction-receipt.tsx`, `packages/contracts/src/index.ts` đang có thay đổi chưa commit (task `transactions-receipt-toggle`). Plan này sửa chồng lên các file đó, giữ nguyên thay đổi hiện có.

## 2. Phạm vi filter theo cột (đề xuất)

| Cột | Kiểu filter ở header | Param backend | Điều kiện SQL |
| --- | --- | --- | --- |
| Hướng (`type`) | Dùng chung state với nút Thu/Chi trên toolbar (đã có, `?type=`) | `type` (có sẵn) | `type = :type` |
| Danh mục | Chọn nhiều (checkbox) từ `useCategoriesQuery` | `categories` (CSV) | `category IN (...)` |
| Ghi chú | Ô text "chứa" | `note` | `note ILIKE %x%` |
| Nơi chốn | Chọn nhiều từ `usePlacesQuery` + mục "Không có nơi chốn" | `placeIds` (CSV, cho phép `none`) | `place_id IN (...)` / `IS NULL` |
| Người tạo | Chọn nhiều từ facet `creators` (xem §3) | `createdByUserIds` (CSV) | `created_by_user_id IN (...)` |
| Ảnh hoá đơn | Tất cả / Có ảnh / Không ảnh | `hasReceipt` (`true`/`false`) | `receipt_url IS NOT NULL AND <> ''` / ngược lại |
| Số tiền | Khoảng min–max | `amountMin`, `amountMax` | `amount BETWEEN` |
| Thời gian | Không thêm — đã do `PeriodFilterToolbar` quản lý | `startAt`/`endAt` | — |

Các filter kết hợp AND với nhau và với `search` hiện có. `runningBalance` / `ledgerBalance` vẫn tính trên toàn sổ (không đổi).

## 3. Thay đổi chi tiết

### 3.1 Contracts (`packages/contracts/src/index.ts`)
- Mở rộng `ITransactionListQuery`: `categories?: string[]`, `note?: string`, `placeIds?: string[]` (phần tử `'none'` = không có nơi chốn), `createdByUserIds?: string[]`, `hasReceipt?: boolean`, `amountMin?: number`, `amountMax?: number`.
- Thêm hằng `TRANSACTION_FILTER_NO_PLACE = 'none'`.
- Thêm vào `ITransactionListResponse`: `facets: { creators: { id: string; name: string }[] }` — danh sách người tạo trong kỳ (để dropdown "Người tạo" không phụ thuộc API `/api/users` vốn dành cho admin).
- i18n: `table.columnFilter.*` (Lọc, Xoá lọc, Áp dụng, Có ảnh, Không ảnh, Không có nơi chốn, Từ, Đến, Chứa…).

### 3.2 Backend (`apps/api/src/finance/`)
- `finance.controller.ts` › `transactionListQuery`: parse/validate param mới (CSV → mảng, trim, bỏ rỗng, giới hạn 50 phần tử; `hasReceipt` chỉ nhận `true|false`; `amountMin/Max` số nguyên ≥ 0 và `min <= max`; sai → `400`).
- `finance.service.ts` › `queryTransactions`: thêm điều kiện vào `base` bằng `In`, `IsNull`, `Between`/`MoreThanOrEqual`/`LessThanOrEqual`, `ILike`. Với `placeIds` có cả id và `none` → tách thành 2 nhánh OR; `hasReceipt` dùng `Raw`/`Not(IsNull())` + loại chuỗi rỗng. Đảm bảo nhân đúng với mảng `where` OR của `search`.
- Facet `creators`: query distinct `createdByUserId` + `createdByName` trong kỳ (chỉ theo `startAt/endAt`, bỏ qua các filter khác để dropdown không tự co lại), tên hiển thị resolve như `transaction-item.mapper.ts`.
- `summary` giữ nguyên ngữ nghĩa hiện tại: chỉ theo kỳ, bỏ qua type/search/filter cột.
- Test: mở rộng `finance-transactions-query.spec.ts` (mỗi filter, kết hợp với search, `placeIds=none`, `hasReceipt`, khoảng tiền) + test validate controller (400).

### 3.3 Web (`apps/web/src/modules/dashboard/`)
- Component mới `presentation/components/column-filter-popover.tsx` (Level 2 molecule): nút icon phễu trong header (có chấm báo khi đang lọc), popover gồm body tuỳ loại (checkbox list có ô tìm, text, range, radio) + nút "Xoá lọc". `stopPropagation` như `ReceiptColumnHeader`, đóng bằng Esc/click ngoài, focus trap nhẹ, `aria-expanded`/`aria-haspopup`. Trên mobile hiển thị dạng sheet full-width.
- `transactions-table.tsx`: prop mới tuỳ chọn `columnFilters?: TransactionColumnFilters` + `onChangeColumnFilters?` + `filterOptions` (categories, places, creators). Chỉ render nút filter khi có `onChangeColumnFilters` → bảng ở Dashboard home không bị ảnh hưởng.
- `transactions-screen.tsx`: state `columnFilters` (text `note` và amount được debounce 300ms như search), gộp vào `listQuery` → query key đổi → backend lọc, `keepPreviousData` giữ dòng cũ khi đang tải. Thêm nút "Xoá tất cả bộ lọc" trên toolbar khi có filter đang bật. Lưu filter vào URL search params (`?categories=…&place=…`) để F5/chia sẻ link giữ nguyên — cùng cơ chế `?type=`.
- `transactions-api.ts`: serialize mảng thành CSV, bỏ key rỗng.
- Không hardcode route; dùng `API_ROUTES` sẵn có.

### 3.4 Docs (Hard Completion Gate)
- `.agents/knowledge/modules/dashboard/` (+ `expenses` nếu chứa contract API thu chi): mô tả param filter mới, facet `creators`, ngữ nghĩa summary.
- `.agents/docs/modules/dashboard/` (VI) tương ứng; cập nhật `.agents/docs/README.md` nếu thêm file. Chạy `node .claude/hooks/docs-drift-check.mjs`.

## 4. Kiểm thử
- `npm run test --workspace @zalobot/api` (spec query), `npm run typecheck`, `npm run lint`, `npm run build --workspace @zalobot/web`.
- Thử tay trên browser: từng filter, kết hợp search + period, load more vẫn đúng tổng, reload giữ filter từ URL, mobile 375px.

## 5. Câu hỏi cần anh chốt
1. Cột **Hướng**: giữ nút Thu/Chi trên toolbar và header chỉ dùng chung state (đề xuất), hay bỏ nút toolbar chuyển hẳn vào header?
2. **Summary** (thanh tổng thu/chi theo kỳ): giữ như hiện tại (không theo filter cột — đề xuất), hay muốn tổng thay đổi theo filter?
3. Có muốn thêm filter cho cột **Số dư lũy kế** không? (Đề xuất không — số này tính trên toàn sổ, lọc theo nó khó dùng và tốn query.)
4. Lưu filter vào URL (đề xuất) hay chỉ giữ trong state, F5 là mất?
