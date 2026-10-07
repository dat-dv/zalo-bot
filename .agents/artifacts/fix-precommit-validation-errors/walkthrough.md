# Walkthrough - Khắc phục lỗi Pre-commit Validation & Đẩy mã nguồn

## 1. Mục tiêu hoàn thành

Đã khắc phục hoàn toàn 5 lỗi chặn quá trình commit trong pre-commit hook của dự án:

- **3 lỗi I18n Safety**: Đã trích xuất và thay thế hardcoded text bằng các translation keys đa ngôn ngữ.
- **2 lỗi Documentation Drift**: Đã cập nhật đầy đủ Canonical Knowledge (tiếng Anh) và Developer Docs (tiếng Việt) cho module `dashboard` và module `expenses`.

---

## 2. Chi tiết các thay đổi

### Gói Contracts (`packages/contracts`)

- Bổ sung 4 translation key vào từ điển `vi` và `en` trong [index.ts](file:///packages/contracts/src/index.ts):
  - `settings.preferences.languageDescription`
  - `settings.preferences.supported`
  - `settings.preferences.themeTitle`
  - `settings.preferences.themeDescription`

### Module Settings (`apps/web/src/modules/settings`)

- [settings-screen.tsx](file:///apps/web/src/modules/settings/view/settings-screen.tsx): Thay thế các chuỗi literal hardcode bằng `{t('...')}`.

### Đồng bộ tài liệu hệ thống

- **Module Dashboard**:
  - [knowledge README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md) (English): Bổ sung mô tả Calendar View Mode Toggle (`CalendarGrid` vs `DataTable`) và tích hợp danh mục tùy chỉnh `useCategoriesQuery()`.
  - [docs README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md) (Tiếng Việt): Bổ sung mô tả chuyển đổi chế độ xem Lịch tháng và gợi ý danh mục giao dịch tự động.
- **Module Expenses**:
  - [knowledge README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/expenses/README.md) (English): Bổ sung tích hợp `useCategoriesQuery('expense')` và query invalidation.
  - [docs README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/expenses/README.md) (Tiếng Việt): Bổ sung chi tiết tích hợp danh mục chi tiêu người dùng đã cấu hình.

---

## 3. Kết quả xác minh (Verification Results)

- **Agent System Validation**: `npm run agent-system:validate -- --check-changes --check-i18n` -> **PASS (100% 0 errors)**
- **Contracts Build**: `npm --workspace=@zalobot/contracts run build` -> **PASS**
- **Typecheck**: `npm run typecheck` -> **PASS (All workspaces: api, web, contracts)**
- **Lint**: `npm run lint` -> **PASS (All workspaces: api, web)**
