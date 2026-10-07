# Kế hoạch sửa lỗi Pre-commit Validation & Commit/Push Code

## 1. Mục tiêu và bối cảnh

Lệnh commit bị chặn bởi `husky` pre-commit hook do phát hiện 5 lỗi xác thực từ `agent-system:validate`:

1. **I18n Safety (3 lỗi)**: Trong `apps/web/src/modules/settings/view/settings-screen.tsx` có hardcoded text ("Đã hỗ trợ", "& Theme", text mô tả).
2. **Documentation Drift (2 lỗi)**: Code trong module `dashboard` (`calendar-screen.tsx`, `transactions-screen.tsx`) và module `expenses` (`expenses-screen.tsx`) đã thay đổi nhưng tài liệu tương ứng tại `.agents/knowledge/modules/` và `.agents/docs/modules/` chưa được cập nhật.

Sau khi khắc phục toàn bộ các lỗi trên, hệ thống sẽ chạy kiểm thử validation, stage các thay đổi, tạo commit và push lên remote repo.

---

## 2. Các thay đổi đề xuất

### A. Gói Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung các key i18n cho cấu hình Preferences trong cả 2 từ điển `vi` và `en`:
  - `settings.preferences.languageDescription`: "Hỗ trợ Tiếng Việt và English" / "Support Vietnamese and English"
  - `settings.preferences.supported`: "Đã hỗ trợ" / "Supported"
  - `settings.preferences.themeTitle`: "Giao diện & Chủ đề" / "Theme & Appearance"
  - `settings.preferences.themeDescription`: "Chế độ Sáng / Tối (Light & Dark mode)" / "Light / Dark mode"

### B. Module Settings (`apps/web/src/modules/settings`)

#### [MODIFY] [settings-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/settings/view/settings-screen.tsx)

- Thay thế các chuỗi hardcoded text tại tab Preferences (dòng 438-462) bằng các translation keys:
  - `{t('settings.preferences.languageDescription')}`
  - `{t('settings.preferences.supported')}`
  - `{t('settings.preferences.themeTitle')}`
  - `{t('settings.preferences.themeDescription')}`

### C. Đồng bộ tài liệu Canonical Knowledge & Developer Docs

#### [MODIFY] [.agents/knowledge/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)

- Cập nhật tài liệu tiếng Anh: Bổ sung mô tả về Calendar View Mode Toggle (chế độ Grid view `CalendarGrid` và Table view `DataTable`) và việc tích hợp danh mục tùy chỉnh `useCategoriesQuery()` vào gợi ý danh mục giao dịch.

#### [MODIFY] [.agents/docs/modules/dashboard/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Cập nhật tài liệu tiếng Việt: Bổ sung cơ chế chuyển đổi chế độ xem Lịch (Grid/Table) và tích hợp danh mục tùy chỉnh từ Settings.

#### [MODIFY] [.agents/knowledge/modules/expenses/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/expenses/README.md)

- Cập nhật tài liệu tiếng Anh: Bổ sung mô tả tích hợp danh mục chi tiêu cấu hình người dùng (`useCategoriesQuery('expense')`) vào autocomplete suggestions và query invalidation.

#### [MODIFY] [.agents/docs/modules/expenses/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/expenses/README.md)

- Cập nhật tài liệu tiếng Việt: Bổ sung mô tả tích hợp danh mục chi tiêu người dùng đã cấu hình.

### D. Kiểm tra & Commit/Push

- Chạy `npm run agent-system:validate -- --check-changes --check-i18n` để xác nhận 0 lỗi.
- Stage các file đã sửa.
- Thực hiện commit và push code lên remote branch.

---

## 3. Kế hoạch xác minh (Verification Plan)

### Automated Tests / Quality Gates

- `npm run agent-system:validate -- --check-changes --check-i18n` (Xác nhận pass 100%)
- `npm run typecheck`
- `npm run lint`

### Manual Verification

- Kiểm tra `git status` và log commit sau khi push.
