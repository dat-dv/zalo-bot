# Báo Cáo Hoàn Thành: Bắt Buộc i18n Cho Text Hiển Thị và Sửa Pre-commit

## 1. Tổng Quan Kết Quả

Đã hoàn thành toàn bộ 4 nội dung trong kế hoạch:

1. **Chuẩn hóa cặp tài liệu i18n**: Cung cấp đầy đủ YAML frontmatter `metadata.agent-artifact`, ánh xạ hai chiều giữa Canonical Knowledge (`.agents/knowledge/global/i18n.md`) và Developer Guide (`.agents/docs/global/i18n.md`).
2. **Quy định bắt buộc i18n (`i18n-no-hardcoded-user-text`)**: Thêm rule toàn cục cấm hardcode văn bản hiển thị tới người dùng trên mọi bề mặt (JSX, zalo UI, toasts/alerts, HTML templates, lỗi hiển thị).
3. **Cơ chế chặn tự động trong Pre-commit**:
   - Viết validator `scripts/agent-system/validators/i18n-strings.ts` quét staged diff (các dòng mã nguồn mới thêm/sửa) trong các file `.ts`, `.tsx`, `.html`.
   - Cung cấp allow-list chính xác cho các giá trị kỹ thuật, URLs, routes, logs, callback IDs, brand names (`zalobot`, `Google`, v.v.) và emojis.
   - Sửa lỗi môi trường sandbox trong pre-commit hook (`scripts/agent-system/precommit/run.mjs`), tự động cấu hình `GIT_CONFIG_GLOBAL="/dev/null"` và fallback an toàn khi gặp lock index.
   - Thêm bộ test hồi quy `scripts/agent-system/validators/i18n-strings.test.ts` (8/8 test cases passed).
4. **Xác minh toàn diện**:
   - `npm run agent-system:validate -- --check-changes --check-drift --check-i18n`: ✅ Passed (81 artifacts, 144 dependencies, 54 pairs, 0 cyclic groups).
   - `node scripts/agent-system/precommit/run.mjs`: ✅ Passed.
   - `npm run typecheck`: ✅ Passed across all workspaces.
   - `npm run lint`: ✅ Passed across all workspaces.

---

## 2. Chi Tiết Các Thay Đổi

### A. Cặp Tài Liệu & Tri Thức Đa Ngôn Ngữ

- [`.agents/knowledge/global/i18n.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/i18n.md): Bổ sung YAML metadata `global-i18n-knowledge`, tài liệu hóa chi tiết kiến trúc i18n, các invariant bắt buộc, chính sách fallback về `vi`, và allow-list kỹ thuật.
- [`.agents/docs/global/i18n.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/i18n.md): Bổ sung metadata `docs-global-i18n`, hướng dẫn lập trình viên chi tiết cách thêm key song ngữ vào `@zalobot/contracts`, quản lý cookie dashboard và kiểm tra pre-commit.

### B. Rule Toàn Cục Mới

- [`.agents/rules/i18n-no-hardcoded-user-text.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/rules/i18n-no-hardcoded-user-text.md): Định nghĩa quy định bất khả xâm phạm cấm hardcode chuỗi ký tự hiển thị người dùng.
- [`.agents/system-explain/rules/i18n-no-hardcoded-user-text.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/system-explain/rules/i18n-no-hardcoded-user-text.md): Sidecar giải thích kiến trúc và mục đích thiết kế của rule.

### C. Validator & Pre-commit Hook

- [`scripts/agent-system/validators/i18n-strings.ts`](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validators/i18n-strings.ts): Validator thông minh quét chuỗi người dùng trong JSX, zalo UI, Toast/Alert, và HTML template; phân biệt rõ với logs, enums, route paths và callback action data.
- [`scripts/agent-system/validators/i18n-strings.test.ts`](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validators/i18n-strings.test.ts): 8 unit test kiểm thử toàn diện các tình huống chặn chuỗi hardcode và cho phép mã hợp lệ.
- [`scripts/agent-system/precommit/run.mjs`](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/precommit/run.mjs): Xử lý biến môi trường git trong sandbox và cơ chế fallback trực tiếp tới validator.
- [`scripts/agent-system/precommit/staged-paths.mjs`](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/precommit/staged-paths.mjs): Nhận diện các file staged TypeScript/TSX/HTML để kích hoạt kiểm tra.
- [`scripts/agent-system/validate.ts`](file:///Users/datdoan/Documents/projects/zalobot/scripts/agent-system/validate.ts): Tích hợp cờ `--check-i18n` và quét diff thay đổi tự động khi `--check-changes` được kích hoạt.
- [`apps/api/src/zalo/services/zalo-ui.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/zalo-ui.service.ts): Chuyển nhãn nút chọn ngôn ngữ zalo sang dùng `translate(locale, 'web.language.vi')` và `translate(locale, 'web.language.en')`.

---

## 3. Kết Quả Kiểm Thử & Xác Minh

```bash
# 1. Chạy test bộ validator i18n mới
npx tsx scripts/agent-system/validators/i18n-strings.test.ts
# Output: 8/8 pass, 0 fail

# 2. Chạy xác thực agent system toàn diện
npm run agent-system:validate -- --check-changes --check-drift --check-i18n
# Output: Agent system validation passed: 81 artifacts, 144 dependencies, 54 pairs, 1 imports, 0 cyclic dependency groups.

# 3. Chạy pre-commit hook
node scripts/agent-system/precommit/run.mjs
# Output: [agent-system] PASS — metadata, links, imports, and graph snapshot are valid

# 4. Kiểm tra TypeScript & ESLint toàn dự án
npm run typecheck
npm run lint
# Output: 0 errors
```
