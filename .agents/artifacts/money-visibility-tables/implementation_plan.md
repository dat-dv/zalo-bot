# Implementation Plan — Áp dụng ẩn/hiện số tiền cho các bảng

- Route: implement | Phase 1 (inspect-and-plan)
- Rủi ro: MEDIUM (2 file UI + docs, đổi hành vi hiển thị)
- Tiền đề: đã xong `money-visibility-no-persist` (provider chỉ còn `useState(false)`, F5 là ẩn).

## Hiện trạng (đã rà soát)

Mọi ô số tiền trong bảng đều đã đi qua `money()` của `MoneyVisibilityProvider` → khi ẩn hiện `••••••`:
- `transactions-table.tsx`: cột Amount (dòng 344), Balance after transaction (dòng 374), số phân bổ nợ (453, 594).
- `expenses-screen.tsx`, `debts-table.tsx`, `debts-screen.tsx`, `analytics-screen.tsx`, `dashboard-home-screen.tsx`, các chart, modal: dùng `useMoneyFormatter`/`useMoneyVisibility`.
- `places-screen.tsx`, `contacts-screen.tsx`: không có cột tiền.

Nguyên nhân anh thấy cột vẫn hiện số: localStorage cũ đang lưu `true` (đã gỡ ở task trước).

**Chỗ còn lộ khi đang ẩn**: thanh tỉ lệ nhỏ dưới số tiền vẫn vẽ độ dài theo `amount / maxAmount` → nhìn vẫn đoán được khoản lớn/nhỏ:
- `apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx` (cột Amount, dòng ~346–354)
- `apps/web/src/modules/expenses/presentation/components/expenses-screen.tsx` (cột Amount, dòng ~289–291)

## Thay đổi

1. Hai file trên: lấy `isMoneyVisible` từ `useMoneyVisibility()`; chỉ render thanh tỉ lệ khi `isMoneyVisible === true`. Khi ẩn chỉ còn `••••••`.
   - `transactions-table.tsx`: thêm `isMoneyVisible` vào deps của `useMemo` cột.
2. Giữ nguyên thanh **% đã trả** ở `debts-table.tsx` (dòng 396, 697): là tiến độ trả nợ, không tiết lộ độ lớn số tiền.
3. Docs: bổ sung câu "khi ẩn số tiền, thanh tỉ lệ số tiền trong bảng cũng ẩn" vào
   - `.agents/knowledge/modules/dashboard/README.md`, `.agents/knowledge/global/web-ui-direction.md`
   - `.agents/docs/modules/dashboard/README.md`, `.agents/docs/global/web-ui-direction.md`

## Ngoài phạm vi
- Không đổi ô input khi sửa inline (vẫn hiện số thật như quy ước).
- Không đổi thanh % đã trả của công nợ (nếu anh muốn ẩn luôn thì báo em).

## Kiểm tra
- `npm run typecheck --workspace @zalobot/web`, eslint 2 file sửa
- `node .claude/hooks/docs-drift-check.mjs`
- Thủ công (cần chạy web zalo-bot; cổng 3000 hiện là project khác): ẩn → bảng Transactions/Expenses chỉ còn `••••••`, không thanh; bấm hiện → có số + thanh; F5 → ẩn lại.
