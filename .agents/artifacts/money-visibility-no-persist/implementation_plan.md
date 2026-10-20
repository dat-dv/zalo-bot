# Implementation Plan — Ẩn/hiện số tiền không lưu localStorage

- Route: implement | Phase 1 (inspect-and-plan)
- Rủi ro: MEDIUM (1 file code + đồng bộ 4 file knowledge/docs, đổi hành vi người dùng thấy)

## Mục tiêu

Nút "Show amounts" / "Hiện số tiền" luôn bắt đầu ở trạng thái **ẩn** (`false`) mỗi lần tải trang. Bấm hiện chỉ có tác dụng trong phiên đang mở (giữ khi chuyển trang trong app), **F5 là ẩn lại**. Không đọc/ghi `localStorage` nữa; trạng thái chỉ nằm trong `useState` của `MoneyVisibilityProvider`.

## Hiện trạng

`apps/web/src/shared/providers/money-visibility-provider.tsx`:
- `getInitialMoneyVisibility()` đọc `localStorage['zalobot-money-visibility']` trong `useEffect` lúc mount → nếu trước đó đã bấm hiện thì F5 vẫn hiện.
- `toggleMoneyVisibility` và `setMoneyVisibility` ghi `localStorage`.

## Thay đổi

### 1. `apps/web/src/shared/providers/money-visibility-provider.tsx`
- Xoá `MONEY_VISIBILITY_STORAGE_KEY`, `getInitialMoneyVisibility()` và `useEffect` khôi phục.
- Chỉ dùng `useState(false)` sẵn có trong provider (provider bọc toàn app nên state này là global cho mọi trang). Không thêm biến cấp module.
- `toggleMoneyVisibility` → `setIsMoneyVisible((prev) => !prev)`; `setMoneyVisibility` → `setIsMoneyVisible(visible)` (bỏ `try/catch` localStorage).
- Giữ nguyên interface `MoneyVisibilityContextValue`, `useMoneyVisibility`, `useMoneyFormatter`, hàm `money()` → không ảnh hưởng nơi dùng.
- Bỏ import `useEffect` nếu không còn dùng.

### 2. Đồng bộ knowledge (EN) & docs (VI)
Sửa câu "persisted in localStorage `zalobot-money-visibility`" thành "in-memory only, resets to hidden on every page load":
- `.agents/knowledge/modules/dashboard/README.md` (dòng ~91)
- `.agents/knowledge/global/web-ui-direction.md` (dòng ~34)
- `.agents/docs/modules/dashboard/README.md` (dòng ~121)
- `.agents/docs/global/web-ui-direction.md` (dòng ~32)

## Ngoài phạm vi
- Không xoá khoá cũ `zalobot-money-visibility` đang nằm trong trình duyệt (code không đọc nữa nên vô hại; anh có thể tự xoá trong DevTools nếu muốn).
- Không đổi UI nút, i18n, hay các localStorage khác (theme, cột bảng).

## Kiểm tra
- `npm run typecheck --workspace @zalobot/web`
- `npm run lint --workspace @zalobot/web`
- `node .claude/hooks/docs-drift-check.mjs`
- Thủ công: bấm hiện → chuyển trang vẫn hiện → F5 → ẩn.
