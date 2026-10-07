# Walkthrough: Chuyển đổi 100% Web UI sang Tailwind CSS v4

Đã hoàn thành chuyển đổi toàn bộ giao diện ứng dụng web từ legacy CSS sang **100% Tailwind CSS utility classes** và dọn dẹp triệt để file `apps/web/src/styles.css` (từ 2.815 dòng xuống còn 37 dòng base setup).

---

## 1. Các thành phần đã chuyển đổi

### Shared UI Components:

1. [`apps/web/src/shared/ui/data-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx):
   - `DataPanel`, `TableColumnSettings` popover, `DataTable` semantic table markup (headers, body tr/td, resize handle, loading skeleton, empty state).
2. [`apps/web/src/shared/ui/category-autocomplete.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/category-autocomplete.tsx):
   - Input autocomplete, dropdown portal listbox menu, option list item.
3. [`apps/web/src/shared/ui/micro-bar-chart.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/micro-bar-chart.tsx):
   - Mini SVG chart container, bar styling, dark/light tooltip, axis labels.
4. [`apps/web/src/shared/ui/trend-summary-strip.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/trend-summary-strip.tsx):
   - KPI metrics cards, chart preview container, grain toggle buttons.
5. [`apps/web/src/shared/ui/app-navigation.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx):
   - Dọn dẹp class thừa `app-nav__close-btn`, hoàn thiện 100% Tailwind classes.

### View Screens:

1. [`apps/web/src/modules/calendar/view/calendar-grid.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/calendar/view/calendar-grid.tsx):
   - Grid 7 cột tháng, event chips, selected day detail panel và quick edit form.
2. [`apps/web/src/modules/contacts/view/combine-contacts-dialog.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/contacts/view/combine-contacts-dialog.tsx):
   - Dialog backdrop, container, form fields, action buttons.
3. [`apps/web/src/modules/contacts/view/contacts-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/contacts/view/contacts-screen.tsx):
   - Table inline edit, batch action toolbar, filter pills, search input.
4. [`apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx):
   - Metric grid, quick-actions strip, admin strip, 6 data panels.
5. [`apps/web/src/modules/dashboard/view/analytics-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx):
   - Bảng giao dịch, bảng công nợ, KPI metric cards, filters.
6. [`apps/web/src/modules/dashboard/view/calendar-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-screen.tsx):
   - Month nav controls, view mode switch (grid / table), table inline edit.
7. [`apps/web/src/modules/dashboard/view/reminders-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/reminders-screen.tsx):
   - Table inline edit (title, notify type, schedule, repeat), badges, actions.
8. [`apps/web/src/modules/dashboard/view/tasks-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-screen.tsx):
   - Task completion checkbox, inline edit, status badges, filter pills.
9. [`apps/web/src/modules/dashboard/view/transactions-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx):
   - Direction badges, category autocomplete, progress bar amount cell, search.
10. [`apps/web/src/modules/debts/view/debts-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx):
    - 3 KPI metric cards, inline edit form, settle button, status badges.
11. [`apps/web/src/modules/expenses/view/expenses-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx):
    - Expenses table, amount progress fill, category autocomplete, filter pills.
12. [`apps/web/src/modules/settings/view/settings-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/settings/view/settings-screen.tsx):
    - Settings tabs (Categories / Preferences), inline add category forms, table actions.

### Legacy CSS Cleanup:

- [`apps/web/src/styles.css`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/styles.css):
  - Rút gọn từ 2.815 dòng xuống còn **37 dòng** chứa base Tailwind CSS v4 setup (`@import 'tailwindcss';`, `@custom-variant dark`, typography & theme root).

---

## 2. Kết quả kiểm tra chất lượng (Quality Gates)

| Lệnh kiểm tra                                         | Kết quả                                                                           | Trạng thái |
| :---------------------------------------------------- | :-------------------------------------------------------------------------------- | :--------- |
| `npm run typecheck`                                   | 0 errors across workspaces (`@zalobot/web`, `@zalobot/api`, `@zalobot/contracts`) | ✅ Passed  |
| `npm run lint`                                        | 0 errors, 0 warnings across workspaces                                            | ✅ Passed  |
| `npm run build --workspace @zalobot/web -- --webpack` | 18/18 static pages compiled & exported successfully                               | ✅ Passed  |
| `npm run agent-system:validate`                       | 88 artifacts, 152 dependencies, 0 cyclic groups                                   | ✅ Passed  |
