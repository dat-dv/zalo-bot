# Walkthrough: Đưa người dùng Zalo vào Contacts và đồng bộ số điện thoại

Plan: [implementation_plan.md](implementation_plan.md). Anh trả lời "triển khai đi", nên em lấy theo đề xuất cho cả ba câu hỏi mở:

1. Đồng bộ bằng nút bấm tay và chỉ đưa users vào danh bạ của admin.
2. Khi trùng tên với một liên hệ chưa gắn thì chỉ gợi ý.
3. Không khoá số điện thoại nhập tay.

## Đã làm

- **Contracts**:
  - Thêm route `contactsSyncUsers` và các type `IContactUserSyncResult` / `IContactUserSyncSuggestion`.
  - Thêm trường `IContactListItem.linkedUser.phoneNumber`.
  - Thêm i18n `contacts.syncUsers.*` và `contacts.phone.*` (vi/en).
- **API**:
  - `finance/contact-user-sync.ts` gồm các hàm thuần: `fillMissingPhones`, `planContactUserSync`, `userDisplayName`.
  - `ContactUserSyncService` và endpoint `POST /api/contacts/sync-users` (chỉ admin).
  - `FinanceService.backfillLinkedPhones` được gọi khi tạo, sửa hoặc gộp liên hệ có gắn user.
  - `FinanceService.normalizeIdentity` chuyển sang `public` để service đồng bộ dùng lại.
  - `UsersService.fillLinkedContactPhones` được gọi trong `updateUserProfile`, `upsertUser` và `syncUsersWithZca`. Repo `DebtContactEntity` được inject trực tiếp, kèm `@Optional`, vì `UsersModule` đã đăng ký entity này.
  - `GET /api/contacts` trả thêm `linkedUser.phoneNumber`.
- **Web (trang Contacts)**:
  - Nút "👥 Đồng bộ người dùng Zalo", chỉ admin thấy.
  - Toast tóm tắt kết quả đồng bộ.
  - Panel "Gợi ý liên kết" có nút Gắn. Nếu API báo lỗi (ví dụ 409) thì toast hiện đúng thông báo của API.
  - Chip `Zalo: <số>` khi số của user khác số của liên hệ.
- **Tài liệu**:
  - knowledge/docs cho `contacts` và `users`.
  - `global/backend-crud-api.md` (EN/VI).
  - Bổ sung thuật ngữ vào `CONTEXT.md`.

## Khác với plan

- Plan dự định nối `UsersService` với phần liên hệ qua port/token. Thực tế em inject thẳng repo liên hệ vào `UsersService`. Cách này đơn giản hơn và không tạo vòng phụ thuộc module.
- Bỏ trường `linkedExisting` khỏi kết quả, vì UI không dùng tới.

## Kiểm tra

- `npm run typecheck`: pass.
- API test: 376/376 pass, trong đó có 7 test mới ở `contact-user-sync.spec.ts` và 2 test số điện thoại mới ở `finance-contact-link.spec.ts`.
- Web test: 23/23 pass.
- `eslint` các file đã sửa: sạch.
- `npm run build` cho web và api: pass.
- `docs-drift-check`: PASS.

## Chưa kiểm tra

- Chưa chạy thử trên app thật với Postgres: nút đồng bộ, gắn theo gợi ý, chip lệch số.
- `syncUsersWithZca` hiện chạy 2 câu `UPDATE` cho mỗi user có số điện thoại. Với vài chục user thì không vấn đề, nhưng chưa tối ưu thành một câu cho cả lô.
