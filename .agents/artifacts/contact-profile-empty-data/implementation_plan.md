# Implementation plan: Hồ sơ hiện cả giao dịch do tài khoản Zalo đã liên kết ghi

- Ngày: 2026-10-23
- Route: implement · Phase 1 (inspect-and-plan)
- Nguồn: [investigation.md](investigation.md)
- Rủi ro: **MEDIUM**. Sửa nhiều file và đổi hành vi của API hồ sơ. Không đổi schema DB, không thêm migration, không đổi shape của contract.

## Mục tiêu

Trang `/contacts/profile?id=…` hiện các giao dịch:
- gắn với người liên quan (`finance_transactions.contact_id = contact.id`), như hiện tại, **hoặc**
- do tài khoản Zalo đã liên kết ghi (`finance_transactions.created_by_user_id = contact.linked_user_id`).

Ví dụ trên prod: hồ sơ Diệu Hằng phải hiện **2 giao dịch, tổng chi 459.620 ₫**.

## Thiết kế

### Backend: `apps/api/src/finance`

1. **`contact-profile.ts`**: thêm hàm thuần `contactProfileTransactionWhere(contact)`.
   - Nhận `Pick<DebtContactEntity, 'id' | 'linkedUserId'>`.
   - Trả `FindOptionsWhere<FinanceTransactionEntity>[]`: `[{ contactId: id }]`, và thêm `{ createdByUserId: linkedUserId }` khi người liên quan có liên kết. Mảng `where` trong TypeORM là OR.
   - Một chỗ duy nhất định nghĩa "giao dịch của hồ sơ" để danh sách và số liệu không lệch nhau.
2. **`finance.service.ts` → `getContactProfile`**:
   - Danh sách giao dịch: `transactionRepo.find({ where: contactProfileTransactionWhere(contact), … })`. Thứ tự sắp xếp, `take: RECENT_TRANSACTIONS` (50) và `relations: { place: true }` giữ nguyên.
   - Số liệu theo loại: query builder hiện tại giữ `.where('t.contact_id = :id', { id })`, và thêm `.orWhere('t.created_by_user_id = :userId', { userId })` khi có `linkedUserId`. Query chỉ có một mệnh đề OR nên không lo lỗi thứ tự AND/OR.
   - Một giao dịch vừa gắn người liên quan vừa do chính họ ghi chỉ được tính **một lần**, nhờ SQL OR.
   - Phần khoản nợ **không đổi** (vẫn lọc theo `contact_id`).
3. **Không đổi** `GET /api/contacts` (cột "Giao dịch" ở danh sách) và combine contacts. Lý do: con số đó cho biết bao nhiêu giao dịch sẽ được **chuyển** sang người liên quan chính khi gộp, mà giao dịch "do họ ghi" thì không chuyển (gắn theo user, không theo contact).

### Contract: `packages/contracts/src/index.ts`

- Không đổi shape. Chỉ sửa comment của `IContactProfileResponse` / `IContactProfileSummary`: giao dịch = gắn với người liên quan **hoặc** do user đã liên kết ghi.
- Thêm i18n (vi + en):
  - `contacts.profile.transactionsScope`: "Gồm giao dịch gắn với người này và giao dịch do tài khoản Zalo của họ ghi." / "Includes transactions linked to this contact and those recorded by their Zalo account."

### Web: `apps/web/src/modules/contacts`

1. **`profile-tables.tsx` → `ProfileTransactionsTable`**:
   - Thêm cột **Người ghi** (`dashboard.columns.createdBy`), giống bảng Thu chi: dòng trên là `createdByName`, dòng dưới nhỏ là nguồn (nhóm/chat riêng/dashboard), dùng lại `describeTransactionSource` từ `@/modules/dashboard/presentation/components/transaction-receipt` (đã có tiền lệ import chéo module: `@/modules/users/api/api-error-message`). Trên điện thoại cột này nằm ở `mobileSlot: 'secondary'`.
   - Prop mới `includesRecorded: boolean`. Khi `true`, mô tả của panel hiện `contacts.profile.transactionsScope`. Nếu đồng thời bị giới hạn 50 dòng thì hiện cả hai, nối bằng ` · `.
2. **`contact-profile-screen.tsx`**: truyền `includesRecorded={Boolean(contact.linkedUserId)}`.
3. Không đổi query key hay invalidation (vẫn `['contacts','profile',id]`).

## Test

- `contact-profile.spec.ts`: `contactProfileTransactionWhere` có liên kết → 2 điều kiện; không liên kết → chỉ `contactId`.
- Spec mới `finance-contact-profile.spec.ts` (theo mẫu fake repo của `finance-transactions-query.spec.ts`):
  - Có liên kết: `transactionRepo.find` nhận `where` 2 phần tử; query builder gọi `orWhere` với `created_by_user_id`; `summary` cộng đúng từ các dòng tổng.
  - Không liên kết: `where` 1 phần tử, không gọi `orWhere`.
  - Người liên quan không tồn tại → `null` (controller trả 404 như cũ).
- Kiểm tra:
  - `npm run test --workspace @zalobot/api`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build --workspace @zalobot/web`
- Thủ công: chạy local, mở một hồ sơ có user liên kết đã ghi giao dịch; kiểm tra bảng, cột Người ghi, 4 ô số liệu, giao diện điện thoại (375px) và dark mode. Sau khi deploy, kiểm tra Diệu Hằng trên prod ra 2 giao dịch / 459.620 ₫ (chỉ đọc, dùng phiên sẵn có).

## Tài liệu (Hard Completion Gate)

| File | Thay đổi |
| --- | --- |
| `CONTEXT.md` | **Hồ sơ**: "…cùng các khoản nợ, giao dịch gắn với họ và giao dịch do tài khoản Zalo đã liên kết của họ ghi." **Người tạo**: đổi "không dùng để lọc dữ liệu" thành "không dùng để giới hạn ai được xem dữ liệu; chỉ dùng khi người dùng chủ động chọn xem (bộ lọc Người ghi ở bảng thu chi, giao dịch do họ ghi trên hồ sơ)". Khớp với thực tế: bảng thu chi đã có bộ lọc theo người ghi. |
| `.agents/knowledge/global/finance-domain.md` | Câu "Never used as a filter" → "Never used to scope visibility; only user-chosen views select by it (transactions creator filter, `getLatestTransaction`, contact profile)." |
| `.agents/docs/global/finance-domain.md` | Câu tiếng Việt tương ứng (nếu có). |
| `.agents/knowledge/modules/contacts/README.md` | Mục Profile page: bỏ giả định "transactions already carry `contact_id`" (bot và dashboard chưa bao giờ ghi cột này cho giao dịch); API `recentTransactions`/`summary` = `contact_id` OR `created_by_user_id = linked_user_id`, mỗi dòng tính một lần; màn hình có cột Người ghi và dòng mô tả phạm vi; `/contacts` list count giữ nguyên và lý do. |
| `.agents/docs/modules/contacts/README.md` | Giải thích nghiệp vụ tương ứng bằng tiếng Việt; thêm `profile-tables.tsx` vào `depends_on`. |
| `.agents/docs/README.md` | Không thêm file mới, chỉ cập nhật nếu docs-drift-check yêu cầu. |

Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## Ngoài phạm vi

- Gắn giao dịch với người liên quan khi ghi qua bot/dashboard (hướng B trong investigation).
- Đổi số "Giao dịch" ở trang `/contacts` và hộp thoại gộp.
- Khoản nợ theo người ghi.
- Index cho `created_by_user_id`: prod mới 27 giao dịch, chưa cần; thêm sau nếu sổ lớn.
- SĐT/thông tin trống: dữ liệu nhập tay, không sửa.

## Rủi ro & hoàn tác

- Ý nghĩa "Tổng thu/Tổng chi" trên hồ sơ rộng hơn trước (gồm giao dịch họ ghi). Dòng mô tả phạm vi trên bảng giải thích điều này.
- Hoàn tác: revert commit. Không có migration hay thay đổi dữ liệu.
