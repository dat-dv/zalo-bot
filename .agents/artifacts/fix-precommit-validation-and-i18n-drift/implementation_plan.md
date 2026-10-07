# Kế hoạch khắc phục lỗi Pre-commit Validation & Documentation Drift

Giải quyết triệt để 13 lỗi kiểm tra pre-commit (`agent-system:validate --check-changes --check-i18n`) nhằm đưa commit về trạng thái hợp lệ tuyệt đối theo chuẩn i18n, Type Safety và Documentation Coverage.

## Phân tích nguyên nhân gốc rễ

1. **Lỗi i18n tại zalo UI (`apps/api/src/zalo/services/zalo-ui.service.ts` & `zalo.update.ts`)**:
   - Các nút tương tác lời nhắc (`🔄 Làm mới`, `❌ Đóng`, `🗑️ Hủy #...`) và tin nhắn phản hồi danh sách lời nhắc (`⏰ Hiện bạn không có lời nhắc nào sắp tới.`, `⚠️ Không thể lấy danh sách lời nhắc: ...`) đang hardcode string literal tiếng Việt thay vì dùng `translate(locale, key, values)`.
2. **Lỗi i18n false-positive trong JSX (`apps/web/src/modules/contacts/view/contacts-screen.tsx`)**:
   - Biểu thức so sánh `{selectedIds.size > 0 && selectedIds.size < filteredContacts.length && (` chứa ký tự `>` và `<` khiến regex `>([^<{}\n]+)<` trong validator nhận diện nhầm đoạn code `0 && selectedIds.size` là text hiển thị JSX.
3. **Lỗi Documentation Drift (`dashboard`, `debts`, `expenses`)**:
   - Các file UI của module `dashboard`, `debts`, `expenses` vừa được nâng cấp với tính năng lọc theo chu kỳ (`PeriodFilterToolbar`), thanh xu hướng (`TrendSummaryStrip`), biểu đồ micro-bar, cấu hình ẩn/hiện cột (`DataTable` column visibility persistence) nhưng tài liệu Canonical Knowledge (`.agents/knowledge/modules/`) và Developer Docs (`.agents/docs/modules/`) chưa được cập nhật tương ứng.

---

## User Review Required

> [!IMPORTANT]
>
> - Bổ sung các translation key mới vào `@zalobot/contracts` cho cả 2 ngôn ngữ (`vi` và `en`).
> - Nâng cấp phương thức `buildRemindersMarkup` trong `zaloUiService` nhận thêm tham số `locale: SupportedLocale = DEFAULT_LOCALE`.
> - Cập nhật đồng bộ tài liệu Canonical Knowledge (English) và Developer Docs (Vietnamese) cho 3 module `dashboard`, `debts`, `expenses`.

---

## Proposed Changes

### 1. Shared Contracts (`packages/contracts`)

#### [MODIFY] [packages/contracts/src/index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys cho `vi` và `en`:
  - `zalo.reminders.empty`: `'⏰ Hiện bạn không có lời nhắc nào sắp tới.'` / `'⏰ You have no upcoming reminders.'`
  - `zalo.reminders.fetchError`: `'⚠️ Không thể lấy danh sách lời nhắc: {error}'` / `'⚠️ Unable to fetch reminders: {error}'`
  - `zalo.reminders.cancelButton`: `'🗑️ Hủy #{index}'` / `'🗑️ Cancel #{index}'`
  - `zalo.reminders.refresh`: `'🔄 Làm mới'` / `'🔄 Refresh'`
  - `zalo.reminders.close`: `'❌ Đóng'` / `'❌ Close'`

---

### 2. Backend zalo Module (`apps/api`)

#### [MODIFY] [apps/api/src/zalo/services/zalo-ui.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts)

- Cập nhật `buildRemindersMarkup(reminders, locale: SupportedLocale = DEFAULT_LOCALE)` sử dụng `translate(locale, 'zalo.reminders.refresh')`, `translate(locale, 'zalo.reminders.close')`, và `translate(locale, 'zalo.reminders.cancelButton', { index })`.

#### [MODIFY] [apps/api/src/zalo/services/zalo-ui.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.spec.ts)

- Điều chỉnh unit test `buildRemindersMarkup` tương thích với cơ chế i18n.

#### [MODIFY] [apps/api/src/zalo/zalo.update.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.update.ts)

- Trong `onRemindersList`: Lấy `locale = await this.usersService.getPreferredLocale(userId)` và truyền vào `translate(...)` cho các thông báo empty, error và gọi `buildRemindersMarkup(upcoming, locale)`.

---

### 3. Frontend Web Module (`apps/web`)

#### [MODIFY] [apps/web/src/modules/contacts/view/contacts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/contacts/view/contacts-screen.tsx)

- Tách biến boolean `isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredContacts.length;` và render `{isPartiallySelected && ( ... )}` để tránh ký tự `<` `>` gây nhiễu validator.

---

### 4. Agent System Validator (`scripts/agent-system`)

#### [MODIFY] [scripts/agent-system/validators/i18n-strings.ts](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validators/i18n-strings.ts)

- Tinh chỉnh cơ chế bóc tách JSX text: loại bỏ nội dung bên trong biểu thức `{...}` trước khi tìm kiếm text giữa các tag `>...<`, ngăn chặn triệt để false-positive khi biểu thức TypeScript chứa toán tử so sánh logic `<` hoặc `>`.

---

### 5. Canonical Knowledge & Developer Docs (`.agents/`)

#### [MODIFY] [.agents/knowledge/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)

#### [MODIFY] [.agents/docs/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Cập nhật mô tả tính năng: Lọc chu kỳ thời gian (`PeriodFilterToolbar`), dải xu hướng trực quan (`TrendSummaryStrip`), và bộ nhớ hiển thị cột (`DataTable` column visibility persistence với `id="transactions"`).

#### [MODIFY] [.agents/knowledge/modules/debts/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md)

#### [MODIFY] [.agents/docs/modules/debts/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/debts/README.md)

- Cập nhật mô tả cấu hình `DataTable` (`id="debts"`, độ rộng cột tối thiểu `minWidth`, các cột quan trọng không cho ẩn `hideable: false`).

#### [MODIFY] [.agents/knowledge/modules/expenses/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/expenses/README.md)

#### [MODIFY] [.agents/docs/modules/expenses/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/expenses/README.md)

- Cập nhật mô tả tính năng: Bộ lọc chu kỳ tháng/tuần/quý/năm, dải xu hướng thu-chi kèm micro bar chart, biểu đồ thanh trực quan theo tỷ lệ phần trăm số tiền chi tiêu trong từng dòng dữ liệu, và lưu trạng thái cột (`id="expenses"`).

---

## Verification Plan

### Automated Tests

- Chạy kiểm tra validate toàn diện:
  ```bash
  npm run agent-system:validate -- --check-changes --check-i18n
  ```
- Chạy unit test backend:
  ```bash
  npm run test:api
  ```
- Kiểm tra typecheck toàn dự án:
  ```bash
  npm run typecheck
  ```
