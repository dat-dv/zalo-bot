# Kế hoạch: Đưa người dùng Zalo vào bảng Contacts và đồng bộ số điện thoại

- Route: `implement` · Phase 1 (Planning) · Authority: `inspect-and-plan`
- Phạm vi anh đã chọn: **gộp vào bảng Contacts**, tức mỗi user có một dòng Người liên quan tương ứng, được tạo và liên kết tự động. Kèm theo là **đồng bộ số điện thoại giữa user và liên hệ đã gắn**.
- Rủi ro: **MEDIUM**. Phần này tự tạo dữ liệu trong danh bạ và có thể ảnh hưởng đến cách bot nhận diện tên khi ghi nợ (xem mục 2). Không cần migration.

## 1. Hiện trạng

- `users.phoneNumber` đã có cột. Admin sửa được qua `UserFormDialog` ở trang ZCA (`PATCH /api/users/:id`).
- "Đồng bộ thông tin" (`UsersService.syncUsersWithZca`) chỉ ghi số khi Zalo trả về số **khác rỗng**. Vì vậy khi Zalo ẩn số, số đã lưu không bị xoá. Tuy nhiên, nếu Zalo trả về một số **khác** thì số đó vẫn ghi đè lên số anh đã nhập tay.
- Danh bạ công nợ (`debt_contacts`) là của **từng chủ sở hữu**. Trên trang `/contacts`, anh chỉ thấy danh bạ của chính anh. Users chỉ xuất hiện dưới dạng badge ở cột "Tài khoản User", và chỉ trên những liên hệ đã được gắn.
- Số điện thoại của liên hệ (`debt_contacts.phone_number`) và của user hiện tách rời, không đồng bộ với nhau.

## 2. Quyết định thiết kế (cần anh duyệt)

1. **Đưa users vào danh bạ của ai?** Đưa vào danh bạ của **admin đang xem**, vì chỉ admin được thấy và liên kết user. Danh bạ của người dùng thường giữ nguyên.
2. **Kích hoạt thế nào?** Bằng nút **"Đồng bộ người dùng Zalo"** trên trang Contacts (chỉ admin), chạy được nhiều lần mà không sinh trùng (idempotent). Không tự chạy khi tải trang, vì như vậy một request đọc lại ghi dữ liệu và rất khó kiểm soát.
3. **Quy tắc với từng user** (bỏ qua chính admin đang xem và tài khoản ZCA của bot):
   - Đã có liên hệ trong danh bạ của anh gắn với user này: **bỏ qua**, chỉ đồng bộ số điện thoại.
   - Chưa có liên hệ nào trùng tên: **tạo mới** Người liên quan (tên lấy theo `alias`, `firstName`, rồi `zaloName`), gắn luôn `linkedUserId` và chép số điện thoại sang.
   - **Đã có liên hệ trùng tên nhưng chưa gắn user**: **không tự tạo và không tự gắn**. User đó được trả về dạng *gợi ý* để anh bấm "Gắn" trong kết quả.
     - Lý do không tự tạo: nếu anh đang có "Trí" trong sổ nợ mà hệ thống tạo thêm một "Trí" nữa, tin nhắn "cho Trí mượn 30k" đang khớp đúng một người sẽ thành trùng tên, và bot sẽ hỏi lại.
     - Lý do không tự gắn: trùng tên chưa chắc là cùng một người.
4. **Đồng bộ số điện thoại (chỉ điền vào chỗ trống, không bao giờ ghi đè):**
   - Khi gắn liên hệ với user (sửa inline, gộp liên hệ, hoặc nút đồng bộ): liên hệ chưa có số thì lấy số của user. User chưa có số thì lấy số của liên hệ.
   - Khi `syncUsersWithZca` hoặc admin sửa user và có số mới: điền vào những liên hệ đã gắn **chưa có số**.
   - Nếu cả hai bên đều có số mà khác nhau: giữ nguyên cả hai và không báo lỗi. Trên trang Contacts, dòng đó hiện một chỉ báo nhỏ "Zalo: <số của user>" để anh biết hai số đang lệch.
   - Lưu ý quyền riêng tư: chiều liên hệ → user lấy số từ danh bạ của bất kỳ ai đã gắn liên kết. Việc gắn chỉ admin làm được, nên chấp nhận được.

## 3. Thay đổi chi tiết

### Contracts
- Thêm route `contactsSyncUsers: '/api/contacts/sync-users'`.
- Thêm `IContactUserSyncResult { created; linkedExisting; phoneFilled; suggestions: { userId; userName; contactId; contactName }[] }`.
- Thêm vào `IContactListItem.linkedUser` trường `phoneNumber?` (số của user, để hiện chỉ báo lệch số).
- Thêm i18n (vi/en) cho nút, kết quả, gợi ý và chỉ báo số Zalo.

### API
- `finance/contact-user-sync.service.ts` (mới, thuộc `FinanceModule`):
  - `syncUsersIntoContacts(ownerId)`: áp quy tắc ở 2.3 cho từng user, trả về `IContactUserSyncResult`.
  - `fillPhones(contact, user)`: hàm thuần, chỉ điền vào chỗ trống, có unit test riêng.
  - `fillLinkedContactPhones(userId, phone)`: dùng cho users sync và khi sửa user.
- `FinanceController`: thêm `POST /api/contacts/sync-users` (chỉ admin).
- `FinanceService.updateContact`, `createContact`, `combineContacts`: sau khi gắn user, gọi `fillPhones`.
- `UsersService.syncUsersWithZca` và `updateUser`: khi số của user thay đổi, gọi `fillLinkedContactPhones`. `UsersService` không phụ thuộc vào `FinanceModule`; hai bên nối qua một port hoặc token để tránh vòng phụ thuộc module.
- `reports.controller.ts` (`GET /api/contacts`): thêm `linkedUser.phoneNumber` vào dữ liệu trả về.
- Unit test:
  - Spec cho sync: tạo mới, bỏ qua liên hệ đã gắn, trả gợi ý khi trùng tên, bỏ qua admin và bot, chạy lại không sinh trùng.
  - Spec cho `fillPhones`: không ghi đè số đã có, điền cả hai chiều.

### Web
- Trang Contacts (admin):
  - Thêm nút **"Đồng bộ người dùng Zalo"** trên thanh công cụ.
  - Sau khi chạy, hiện toast tóm tắt: "Đã thêm X · Điền SĐT Y · Z gợi ý".
  - Nếu có gợi ý, mở một panel nhỏ liệt kê "User Trí ↔ liên hệ Trí", mỗi dòng có nút **Gắn** (gọi `PATCH` với `linkedUserId`).
- Cột Số điện thoại hiện chỉ báo `Zalo: <số>` khi số của user khác số của liên hệ.
- Mutation invalidate `contacts` và `users`.

### Tài liệu
- Cập nhật knowledge/docs cho `contacts` và `users` (EN/VI), `global/backend-crud-api.md`, và bổ sung quy tắc đồng bộ số điện thoại vào `CONTEXT.md`.

## 4. Kiểm tra

```bash
npm run typecheck
npm run test --workspace @zalobot/api
npm run build --workspace @zalobot/web
node .claude/hooks/docs-drift-check.mjs
```

Kèm `eslint` cho các file đã sửa (lint toàn repo vẫn còn lỗi có từ trước).

## 5. Câu hỏi mở

1. Đồng ý với 2.2: dùng **nút bấm tay** thay vì tự chạy, và chỉ đưa users vào **danh bạ của admin**?
2. Đồng ý với 2.3: khi **trùng tên thì chỉ gợi ý**, không tự tạo và không tự gắn?
3. Có muốn **khoá số nhập tay** không? Tức là `syncUsersWithZca` không ghi đè số admin đã nhập kể cả khi Zalo trả về một số khác. Ở câu hỏi trước anh chưa chọn mục này, nên plan hiện **chưa** có phần này.
