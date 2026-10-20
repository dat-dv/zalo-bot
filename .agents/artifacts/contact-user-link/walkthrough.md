# Walkthrough: Liên kết Người liên quan ↔ User

Plan đã duyệt: [implementation_plan.md](implementation_plan.md). Anh đã chốt cả hai quy tắc: chỉ admin được gắn, và trong một danh bạ mỗi user chỉ gắn với một liên hệ.

## Đã làm

- **Contracts**:
  - Thêm route `API_ROUTES.usersLinkedContacts(id)`.
  - Thêm type `IUserLinkedContactItem` và trường `IUserListItem.linkedContactCount`.
  - Thêm i18n `users.linkedContacts.*`, `contacts.inlineEdit.noLinkedUser`, `contacts.inlineEdit.linkedUserLabel` (vi/en).
- **API**:
  - `DebtContactEntity.linkedUserId/linkedUser` chuyển sang nullable.
  - Thêm `FinanceService.resolveLinkedUser`, áp dụng cho tạo, sửa và gộp liên hệ. User phải tồn tại (sai thì trả 400), không được là chủ danh bạ (400), và không được trùng trong cùng một danh bạ (409).
  - Mỗi lần ghi đều gán cả cột lẫn relation. Đây là chỗ sửa lỗi bỏ liên kết trước đây không có tác dụng.
  - `FinanceController.linkedUserId()` trả 403 nếu người không phải admin gửi `linkedUserId`.
  - `FinanceModule` import `UsersModule` qua `forwardRef`.
  - Thêm `UserLinkedContactsService` (`countByLinkedUser` dùng một truy vấn GROUP BY, `listForUser`). `GET /api/users` trả thêm `linkedContactCount`. Thêm endpoint `GET /api/users/:id/linked-contacts` (chỉ admin).
- **Web**:
  - Trang Contacts: khi sửa inline, admin thấy ô chọn user và chỉ gửi `linkedUserId` nếu giá trị thay đổi.
  - Hộp thoại Gộp liên hệ chỉ hiện ô chọn user với admin.
  - `useUsersQuery` không retry khi gặp 403.
  - Các mutation của contacts invalidate thêm query `users`.
  - Trang ZCA: thêm badge "🔗 N người liên quan", mục menu "Xem người liên quan đã gắn" và `LinkedContactsDialog` (có đủ trạng thái loading, lỗi kèm thử lại, rỗng, danh sách).
- **Tài liệu**:
  - knowledge và docs cho `contacts`, `users`, `zca`.
  - `global/backend-crud-api.md` (EN/VI) và `knowledge/global/finance-domain.md`.
  - Thêm thuật ngữ "Liên kết tài khoản" vào `CONTEXT.md`.

## Kiểm tra đã chạy

- `npm run typecheck`: pass (api, web, contracts).
- `npm run test --workspace @zalobot/api`: 369/369 pass, trong đó có 9 test mới ở `finance-contact-link.spec.ts`.
- `npm run test --workspace @zalobot/web`: 23/23 pass.
- `eslint` trên các file đã sửa: sạch. `npm run lint` toàn repo vẫn còn lỗi có từ trước ở các file khác, như `zca-query.ts` và các file zalo/zca dùng `any`. Mình không sửa vì nằm ngoài phạm vi.
- `npm run build` cho web và api: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm tra

- Chưa test tay trên app thật: admin gắn/bỏ gắn rồi reload, badge và dialog trên trang ZCA, người dùng thường không thấy ô chọn.
- Truy vấn GROUP BY của `UserLinkedContactsService` chưa chạy trên Postgres thật, mới chỉ có unit test cho phần mapping.
