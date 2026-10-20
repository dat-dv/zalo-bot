# Kế hoạch: Liên kết Người liên quan (Contacts) với Người dùng (ZCA)

- Route: `implement` · Phase 1 (Planning) · Authority: `inspect-and-plan`
- Phạm vi đã chốt: **gắn tay trên web** (form sửa Người liên quan) + **trang ZCA hiện Người liên quan đã gắn với từng user**. Không gồm bot tự liên kết, đồng bộ nợ hai phía, nhắc nợ.
- Rủi ro: **MEDIUM**. Có thêm một API mới, đổi kiểu `linkedUserId` sang nullable, sửa contract chung. Không cần migration vì cột `linked_user_id` đã có.

## 1. Hiện trạng (đã kiểm tra trong code)

| Hạng mục | Hiện trạng | Vấn đề |
| --- | --- | --- |
| DB | `debt_contacts.linked_user_id` đã có, có index ([debt-contact.entity.ts:55](../../../apps/api/src/database/entities/debt-contact.entity.ts)). Migration không tạo FK. | Có thể lưu một ID không tồn tại. |
| API sửa liên hệ | `PATCH /api/contacts/:id` có nhận `linkedUserId` ([finance.service.ts](../../../apps/api/src/finance/finance.service.ts) `updateContact`). | **Lỗi bỏ liên kết**: gửi `null` thì service gán `undefined`, và TypeORM bỏ qua cột này khi `save`, nên liên kết cũ vẫn còn. Không kiểm tra user có tồn tại hay không, cũng không chặn tự liên kết với chính mình. |
| Web Contacts | Có cột "Tài khoản User" chỉ để xem. Sửa inline không có ô chọn user. Chỉ hộp thoại Gộp có ô chọn. | Không có cách gắn hoặc bỏ gắn cho từng liên hệ. |
| Danh sách user | `GET /api/users` **chỉ admin gọi được**. | Người dùng thường mở ô chọn user sẽ thấy danh sách rỗng hoặc lỗi 403 (hộp thoại Gộp hiện đã gặp lỗi này). |
| Trang ZCA | Bảng user/thread không có thông tin gì về Người liên quan. | Không biết user nào đang được gắn với những Người liên quan nào. |

## 2. Quyết định thiết kế (cần anh duyệt)

1. **Chỉ admin được gắn hoặc bỏ gắn liên kết.** Lý do: muốn chọn user thì phải xem được danh sách toàn bộ user hệ thống, mà danh sách này đang là dữ liệu chỉ admin xem. Người dùng thường vẫn thấy badge liên kết ở dạng chỉ đọc. Nếu người dùng thường gửi `linkedUserId`, API trả **403**.
   - Phương án khác (không làm trong plan này): mở endpoint "user có thể liên kết" cho mọi người, giới hạn trong các user cùng nhóm Zalo. Phương án này cần quy tắc quyền riêng tư, nên để làm sau.
2. **Một user chỉ được gắn với tối đa một Người liên quan trong danh bạ của cùng một chủ sở hữu.** Nếu trùng, API báo lỗi và gợi ý dùng Gộp liên hệ. Danh bạ của các chủ sở hữu khác nhau vẫn có thể cùng gắn tới một user.
3. **Không cho gắn Người liên quan với chính chủ sở hữu danh bạ** (`linkedUserId === userId`).
4. `linkedUserId` phải tồn tại trong bảng `users`, nếu không API trả 400.

## 3. Thay đổi chi tiết

### 3.1 Contracts (`packages/contracts/src/index.ts`)
- Thêm route `usersLinkedContacts: (id: string) => \`/api/users/${id}/linked-contacts\``.
- Thêm `IUserLinkedContactItem { contactId; displayName; alias?; ownerUserId; ownerName?; debtCount; createdAt }`.
- Thêm `linkedContactCount?: number` vào `IUserListItem` để bảng ZCA hiện số mà không phải gọi N lần.
- Thêm i18n (vi/en): `contacts.inlineEdit.linkedUser*` (nhãn, "Không liên kết", chỉ admin), `users.linkedContacts.*` (tiêu đề dialog, danh sách rỗng, cột chủ sở hữu, menu "Xem người liên quan đã gắn"), và các thông báo lỗi.

### 3.2 API (`apps/api`)
- `database/entities/debt-contact.entity.ts`: đổi kiểu `linkedUserId` thành `string | null` để ghi được `NULL`. Không cần migration.
- `finance/finance.service.ts`:
  - Thêm hàm private `assertLinkableUser(ownerId, contactId, linkedUserId)`. Hàm kiểm tra user có tồn tại, không phải chính chủ sở hữu, và chưa được gắn với liên hệ khác của cùng chủ sở hữu (quyết định 2–4).
  - `updateContact` và `createContact`: gán `null` khi bỏ liên kết, gọi `assertLinkableUser` khi gắn. Trả về entity kèm relation `linkedUser` để web cập nhật badge ngay.
  - `combineContacts`: dùng chung `assertLinkableUser` với cùng quy tắc, nhưng bỏ qua các liên hệ sắp bị gộp.
- `finance/finance.controller.ts`: khi body có `linkedUserId` (kể cả `null`) mà người gọi không phải admin thì trả 403. Dùng lại `UsersService.isAdmin`.
- `users/users.service.ts` + `users.controller.ts`:
  - `GET /api/users`: bổ sung `linkedContactCount` bằng một truy vấn `GROUP BY linked_user_id` (không gây N+1).
  - `GET /api/users/:id/linked-contacts` (chỉ admin): liệt kê các Người liên quan đang gắn tới user này, kèm tên chủ sở hữu và số khoản nợ.
- Unit test:
  - `finance.service.spec.ts`: gắn, bỏ gắn (`null` thực sự xoá liên kết), user không tồn tại, tự gắn chính mình, trùng trong cùng danh bạ.
  - Spec cho users: `linkedContactCount` và endpoint `linked-contacts`.

### 3.3 Web (`apps/web`)
- `modules/contacts/presentation/components/contacts-screen.tsx`:
  - Thêm `linkedUserId` vào `editDraft`.
  - Khi đang sửa inline, cột "Tài khoản User" thành `<select>` (lấy từ `useUsersQuery`, chỉ bật khi người xem là admin), có lựa chọn "Không liên kết".
  - Khi lưu, chỉ gửi `linkedUserId` nếu giá trị thay đổi (`null` khi bỏ liên kết).
  - Người không phải admin vẫn thấy badge ở dạng chỉ đọc như hiện nay.
- `combine-contacts-dialog.tsx`: chỉ hiện ô chọn user khi người xem là admin, để sửa lỗi danh sách rỗng hoặc 403 cho người dùng thường.
- `modules/users/api/users-api.ts` + `users-query.ts`: thêm `getUserLinkedContacts` và `useUserLinkedContactsQuery(id)`. Query key nằm trong factory hiện có, có `AbortSignal`.
- `modules/users/presentation/components/linked-contacts-dialog.tsx` (mới): dialog dùng `Modal` chung, có đủ 4 trạng thái (loading / error / empty / list), mỗi dòng có link `APP_ROUTES.contacts`.
- `modules/zca/presentation/components/chat-table-row.tsx` + `zca-screen.tsx`:
  - Với dòng có `row.user`, hiện badge "🔗 N người liên quan" khi `linkedContactCount > 0`.
  - Thêm mục menu "Xem người liên quan đã gắn" để mở dialog.
- Sau khi sửa liên hệ thành công, invalidate cả `contacts.list` và `users.list` để số trên trang ZCA luôn đúng.

### 3.4 Tài liệu (Hard Completion Gate)
- `.agents/knowledge/modules/contacts/README.md` (EN): quy tắc liên kết, chỉ admin, ràng buộc 2–4.
- `.agents/knowledge/modules/users/README.md` và `zca/README.md` (EN): `linkedContactCount` và endpoint `linked-contacts`.
- `.agents/docs/modules/contacts|users|zca/README.md` (VI): giải thích lý do nghiệp vụ và thao tác gắn/bỏ gắn.
- Cập nhật `.agents/docs/README.md` nếu bảng ánh xạ thay đổi.
- Thêm thuật ngữ **Liên kết tài khoản** vào phần Công nợ trong `CONTEXT.md`.

## 4. Lưu ý về working tree hiện tại

`finance.controller.ts`, `finance.service.ts`, `reports.controller.ts` và `packages/contracts/src/index.ts` đang có thay đổi chưa commit của task `transactions-ledger-api`. Ở Phase 2 mình sẽ chỉ thêm phần sửa của task này lên trên, **không revert hay đụng vào** phần đang dở của task kia. Nếu anh muốn tách rõ hai việc, nên commit task kia trước.

## 5. Kiểm tra

```bash
npm run typecheck
npm run lint
npm run test --workspace @zalobot/api
npm run build --workspace @zalobot/web
node .claude/hooks/docs-drift-check.mjs
```

Kiểm tra tay trên dev:
- Admin gắn rồi bỏ gắn một liên hệ, sau đó reload trang để chắc liên kết đã thực sự mất.
- Trang ZCA hiện đúng badge và dialog.
- Người dùng thường không thấy ô chọn user và bị 403 nếu gọi API trực tiếp.

## 6. Câu hỏi mở

1. Đồng ý **chỉ admin được gắn** (quyết định 1) không?
2. Đồng ý ràng buộc **một user tối đa một liên hệ trong cùng một danh bạ** (quyết định 2) không?
