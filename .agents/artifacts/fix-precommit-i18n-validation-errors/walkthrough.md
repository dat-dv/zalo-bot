# Walkthrough: Khắc phục lỗi Git Pre-commit Validation (i18n Safety)

## Tổng quan

Đã xử lý triệt để 15 lỗi khiến git pre-commit hook (`agent-system:validate --check-changes --check-i18n`) bị fail:

1. Sửa 2 hardcoded props hiển thị trong `calendar-screen.tsx` sang sử dụng key i18n chuẩn.
2. Xử lý 13 false-positives trong bộ validator `i18n-strings.ts` đối với các chữ ký kiểu TypeScript / Arrow functions trong file `.tsx`.

---

## Chi tiết các thay đổi

### 1. Web Dashboard View

- **[calendar-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/calendar-screen.tsx)**:
  - Thay `aria-label="Previous month"` bằng `aria-label={t('calendar.nav.prev')}`.
  - Thay `aria-label="Next month"` bằng `aria-label={t('calendar.nav.next')}`.

### 2. Agent System Validator

- **[i18n-strings.ts](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validators/i18n-strings.ts)**:
  - Thêm tiền xử lý cho `sanitizedJsxLine`:
    - Loại bỏ các toán tử `=>`, `>=`, `<=`.
    - Loại bỏ TypeScript generic types dạng `Identifier<...>` (ví dụ `Promise<void>`, `Array<string>`, `React.SetStateAction<...>`).
  - Ngăn chặn regex nhận diện sai ký tự `>` trong `=>` và `<` trong `<void>` thành JSX tag text.
- **[i18n-strings.test.ts](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validators/i18n-strings.test.ts)**:
  - Bổ sung unit test xác thực các interface TypeScript và hàm arrow trong file `.tsx` không bị vi phạm `i18n-jsx-text`.

---

## Kết quả kiểm thử & xác thực

- **Unit tests validator**:
  ```bash
  npx tsx --test scripts/agent-system/validators/i18n-strings.test.ts
  # 9/9 tests pass (100%)
  ```
- **Hệ thống Validation**:
  ```bash
  npm run agent-system:validate -- --check-changes --check-i18n
  # Agent system validation passed: 90 artifacts, 156 dependencies, 56 pairs, 1 imports, 0 cyclic dependency groups.
  ```
- **Typecheck & Lint**:
  ```bash
  npm run typecheck # Passed
  npm run lint      # Passed
  ```
