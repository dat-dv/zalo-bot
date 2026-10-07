# Kế hoạch Cập nhật Quy định i18n và Tích hợp Frontend Orchestration

Tăng cường và chuẩn hóa các quy định về đa ngôn ngữ (i18n), zero-hardcoded-user-text cho giao diện JSX/Next.js và tích hợp trực tiếp vào plugin `frontend-orchestration` cùng tài liệu tri thức hệ thống.

## User Review Required

> [!IMPORTANT]
> **Phạm vi cập nhật quy định & tri thức**:
>
> 1. Bổ sung các kịch bản thực tế trong JSX vào quy tắc [`i18n-no-hardcoded-user-text.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/rules/i18n-no-hardcoded-user-text.md):
>    - Định nghĩa tiêu đề cột trong bảng dữ liệu (`DataTableColumn.header`).
>    - Tiêu đề & mô tả của panel/container (`DataPanel.title`, `DataPanel.description`).
>    - Thông báo rỗng và thông báo lỗi (`emptyMessage`, `ariaLabel`, error alerts).
>    - Quy chuẩn hàm format tiền tệ và ngày tháng động theo `localeTag(locale)` thay vì hardcode `'vi-VN'` / `'VND'`.
> 2. Tích hợp ràng buộc i18n vào plugin `frontend-orchestration`:
>    - Cập nhật [`02-atomic-ui-and-primitives.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/plugins/frontend-orchestration/rules/02-atomic-ui-and-primitives.md) và [`04-validation-and-quality-gates.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/plugins/frontend-orchestration/rules/04-validation-and-quality-gates.md).
> 3. Cập nhật các sidecar giải thích hệ thống (`.agents/system-explain/...`) kèm `semantic review receipt` để vượt qua `npm run agent-system:validate`.
> 4. Đồng bộ tri thức chuẩn hóa tại `.agents/knowledge/global/i18n.md` và tài liệu hướng dẫn nhà phát triển `.agents/docs/global/i18n.md`.

---

## Proposed Changes

### Core Rules & Sidecars

#### [MODIFY] [i18n-no-hardcoded-user-text.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/rules/i18n-no-hardcoded-user-text.md)

- Bổ sung bảng đối chiếu chi tiết cho JSX Table Columns, Empty States, Aria-labels, và Locale-aware Formats (`Intl.NumberFormat`, `Intl.DateTimeFormat`).
- Quy định rõ ràng về việc không hardcode chuỗi fallback (như `'Chưa đặt'`, `'—'` cho text).

#### [MODIFY] [i18n-no-hardcoded-user-text.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/system-explain/rules/i18n-no-hardcoded-user-text.md)

- Cập nhật digest ngữ nghĩa và giải thích quy định.

---

### Frontend Orchestration Plugin Rules

#### [MODIFY] [02-atomic-ui-and-primitives.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/plugins/frontend-orchestration/rules/02-atomic-ui-and-primitives.md)

- Bổ sung mục quy định bắt buộc: Tất cả Level 3 Organisms, Level 4 Views, và Level 5 Pages phải tiêu thụ text hiển thị người dùng qua i18n hook (`useLocale` / `t()`).

#### [MODIFY] [04-validation-and-quality-gates.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/plugins/frontend-orchestration/rules/04-validation-and-quality-gates.md)

- Bổ sung i18n checklist vào Quality Gate trước khi hoàn tất code giao diện.

#### [MODIFY] Sidecars tương ứng trong `.agents/system-explain/plugins/frontend-orchestration/`

- Đồng bộ semantic review receipts và artifact mappings.

---

### System Knowledge & Developer Documentation

#### [MODIFY] [i18n.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/i18n.md)

- Cập nhật specification tiếng Anh cho i18n architecture, locale-aware formatting, và JSX contracts.

#### [NEW] [i18n.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/i18n.md)

- Tạo tài liệu hướng dẫn tiếng Việt cho developer về cách khai báo key trong `@zalobot/contracts`, sử dụng `useLocale()` trong UI components, và cách cấu hình formatting theo ngôn ngữ.

#### [MODIFY] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/README.md)

- Đăng ký mục `global/i18n.md` vào mục lục tài liệu nhà phát triển.

---

## Verification Plan

### Automated Tests & Validation

- Chạy `npm run agent-system:validate` để kiểm tra toàn bộ 80+ artifacts, link integrity, dependencies graph, và semantic review receipts.
- Chạy `npm run typecheck` để đảm bảo không có lỗi type nào trong hệ thống script.

### Manual Verification

- Kiểm tra lại các file rules và tài liệu sau khi tạo để đảm bảo cấu trúc frontmatter chuẩn xác và không vi phạm Zero-Any / Zero-Hardcoded rules.
