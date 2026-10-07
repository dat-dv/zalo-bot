# Walkthrough: Khắc phục lỗi Pre-commit Validation & Documentation Drift

Đã khắc phục hoàn toàn 13 lỗi pre-commit validation liên quan đến i18n, JSX false-positives và Documentation Drift.

## Các thay đổi chính đã thực hiện

### 1. Đa ngôn ngữ (i18n) cho zalo UI Service & Update

- **[`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**:
  - Bổ sung translation keys cho `vi` và `en`:
    - `zalo.reminders.empty`
    - `zalo.reminders.fetchError`
    - `zalo.reminders.cancelButton`
    - `zalo.reminders.refresh`
    - `zalo.reminders.close`
- **[`apps/api/src/zalo/services/zalo-ui.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)**:
  - Cập nhật phương thức `buildRemindersMarkup` nhận tham số `locale: SupportedLocale = DEFAULT_LOCALE` và gọi `translate(locale, ...)` cho tất cả nhãn nút bấm.
- **[`apps/api/src/zalo/zalo.update.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.update.ts)**:
  - Cập nhật `onRemindersList` tự động xác định preferred locale của người dùng và dịch toàn bộ nội dung tin nhắn empty, tin nhắn lỗi và markup bàn phím tương tác.

### 2. Tinh chỉnh Regex Validator & Code JSX

- **[`scripts/agent-system/validators/i18n-strings.ts`](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validators/i18n-strings.ts)**:
  - Xóa biểu thức `{...}` trước khi quét JSX text và yêu cầu ký tự `<` theo sau phải là định dạng thẻ JSX (`<(?=[a-zA-Z\/]|>)`), loại bỏ triệt để false-positives khi code TypeScript chứa toán tử so sánh `<` hoặc `>`.
- **[`apps/web/src/modules/contacts/view/contacts-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/contacts/view/contacts-screen.tsx)**:
  - Tách biến boolean `isPartiallySelected` sạch sẽ và dễ đọc.

### 3. Đồng bộ Canonical Knowledge & Developer Docs

- **Dashboard Module**:
  - [`knowledge/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md) (English)
  - [`docs/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md) (Vietnamese)
  - Bổ sung mô tả `PeriodFilterToolbar`, `TrendSummaryStrip`, `MicroBarChart` và cấu hình lưu trạng thái ẩn/hiện cột `DataTable` (`id="transactions"`).
- **Debts Module**:
  - [`knowledge/modules/debts/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md) (English)
  - [`docs/modules/debts/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/debts/README.md) (Vietnamese)
  - Bổ sung mô tả `DataTable` (`id="debts"`), độ rộng tối thiểu cột `minWidth`, khóa không ẩn các cột `counterparty` và `remainingAmount`.
- **Expenses Module**:
  - [`knowledge/modules/expenses/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/expenses/README.md) (English)
  - [`docs/modules/expenses/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/expenses/README.md) (Vietnamese)
  - Bổ sung mô tả `PeriodFilterToolbar`, `TrendSummaryStrip`, biểu đồ thanh tỷ lệ phần trăm số tiền trong ô `amount` và `DataTable` (`id="expenses"`).

---

## Kết quả kiểm thử & xác thực

| Kiểm tra                           | Lệnh thực hiện                                                      | Kết quả                                              |
| :--------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------- |
| **Agent System & i18n Validation** | `npm run agent-system:validate -- --check-changes --check-i18n`     | ✅ **PASS** (0 errors)                               |
| **Monorepo Typecheck**             | `npm run typecheck`                                                 | ✅ **PASS** (0 errors across api, web, contracts)    |
| **Unit Tests**                     | `npx tsx --test apps/api/src/zalo/services/zalo-ui.service.spec.ts` | ✅ **PASS** (16/16 tests)                            |
| **Linting**                        | `npm run lint`                                                      | ✅ **PASS** (0 errors)                               |
| **Monorepo Build**                 | `npm run build`                                                     | ✅ **PASS** (contracts, api, web built successfully) |
