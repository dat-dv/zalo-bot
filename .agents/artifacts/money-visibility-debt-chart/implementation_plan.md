# Implementation Plan — Ẩn thanh tỉ lệ trong biểu đồ công nợ khi ẩn số tiền

- Route: implement | Phase 1 (inspect-and-plan)
- Rủi ro: LOW–MEDIUM (1 file UI + docs, chỉ đổi hiển thị khi đang ẩn)
- Nối tiếp: `money-visibility-no-persist`, `money-visibility-tables`.

## Hiện trạng

`apps/web/src/shared/ui/charts/debt-structure-chart.tsx` (dùng ở Analytics, `analytics-screen.tsx:429`):
- Số tiền đã qua `money()` → khi ẩn hiện `••••••`.
- Nhưng còn lộ độ lớn khi đang ẩn:
  1. Thanh tỉ lệ Phải thu / Phải trả (dòng 50–61): độ rộng theo `receivable/total`, và `title` tooltip hiện thẳng `xx.x%`.
  2. Thanh dưới từng người trong Top phải thu / phải trả (dòng 86–91, 117–122): độ rộng theo `amount / maxIndividual`.

## Thay đổi

1. Đổi `useMoneyFormatter()` → `const { money, isMoneyVisible } = useMoneyVisibility();`.
2. Chỉ render thanh tỉ lệ Phải thu/Phải trả (kèm tooltip %) khi `isMoneyVisible`.
3. Chỉ render thanh dưới từng người khi `isMoneyVisible`. Tên người và `••••••` vẫn hiện.
4. Comment ngắn lý do (độ dài thanh để lộ độ lớn tương đối), giống 2 bảng đã sửa.

## Docs
- `.agents/knowledge/global/web-ui-direction.md` + `.agents/docs/global/web-ui-direction.md`: bổ sung "biểu đồ cơ cấu công nợ ẩn thanh tỉ lệ khi ẩn số tiền".
- Kiểm tra `.agents/knowledge/modules/dashboard/README.md` / `.agents/docs/modules/dashboard/README.md` (mục Analytics) nếu có mô tả biểu đồ thì cập nhật cùng.

## Ngoài phạm vi
- Thứ tự Top 3 vẫn sắp theo số tiền (vẫn đoán được ai nhiều nhất) — giữ nguyên vì danh sách không có nghĩa nếu bỏ thứ tự.
- Không đổi dấu/màu Net cashflow, thanh % đã trả ở Debts.
- Không đụng các thay đổi đang dở ở `apps/api`, `packages/contracts`, `apps/web/src/modules/users`.

## Kiểm tra
- `npm run typecheck --workspace @zalobot/web`, eslint file sửa
- `node .claude/hooks/docs-drift-check.mjs` (lưu ý: có thể vẫn báo module `users` do thay đổi không thuộc task này)
- Thủ công tại `/analytics`: ẩn → không còn thanh; hiện → có thanh; F5 → ẩn.
