# Walkthrough: Hồ sơ hiện cả giao dịch do tài khoản Zalo đã liên kết ghi

- Ngày: 2026-10-23
- Plan: [implementation_plan.md](implementation_plan.md) (đã duyệt) · Chẩn đoán: [investigation.md](investigation.md)

## Đã thay đổi

| File | Nội dung |
| --- | --- |
| `apps/api/src/finance/contact-profile.ts` | Hàm thuần `contactProfileTransactionWhere(contact)`: `[{contactId}]`, thêm `{createdByUserId: linkedUserId}` khi có liên kết. |
| `apps/api/src/finance/finance.service.ts` | `getContactProfile`: danh sách dùng hàm trên; câu tổng theo loại thêm `orWhere('t.created_by_user_id = :linkedUserId')` khi có liên kết. Khoản nợ không đổi. |
| `apps/api/src/finance/contact-profile.spec.ts` | Test hàm điều kiện (có/không liên kết, `null`). |
| `apps/api/src/finance/finance-contact-profile.spec.ts` (mới) | Test service: có liên kết (where 2 phần tử + `orWhere`, summary 2 giao dịch / 459.620 ₫), không liên kết, không tồn tại → `null`. |
| `packages/contracts/src/index.ts` | Comment `IContactProfileSummary` / `IContactProfileResponse`; i18n `contacts.profile.transactionsScope` (vi, en). Không đổi shape. |
| `apps/web/.../contact-profile/profile-tables.tsx` | Cột **Người tạo** (tên + nguồn, dùng `describeTransactionSource`), prop `includesRecorded`, mô tả panel nối ` · ` với ghi chú giới hạn 50 dòng. |
| `apps/web/.../view/contact-profile-screen.tsx` | Truyền `includesRecorded={Boolean(contact.linkedUserId)}`. |
| `CONTEXT.md` | Định nghĩa **Hồ sơ** và **Người tạo** (không giới hạn quyền xem; chỉ dùng khi người dùng chủ động chọn xem). |
| `.agents/knowledge|docs/global/finance-domain.md` | Câu quy tắc người tạo tương ứng. |
| `.agents/knowledge|docs/modules/contacts/README.md` | Phạm vi giao dịch của hồ sơ, lý do giữ số đếm ở `/contacts`, cột Người tạo; `depends_on` thêm `profile-tables.tsx`, spec mới. |

## Kiểm chứng đã chạy

- `npm run build --workspace @zalobot/contracts` (web đọc type từ `dist`).
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test`: api 706/706, web 138/138 pass.
- `npm run build --workspace @zalobot/web`: exit 0.
- `node .claude/hooks/docs-drift-check.mjs`: PASS (0 errors).
- SQL sinh từ metadata TypeORM (không kết nối DB, script trong scratchpad):
  - Có liên kết: danh sách `WHERE (contact_id = $1) OR (created_by_user_id = $2) ORDER BY occurred_at DESC, created_at DESC, id DESC LIMIT 50`; tổng `WHERE contact_id = :id OR created_by_user_id = :linkedUserId GROUP BY type`. Cùng tập dòng.
  - Không liên kết: cả hai chỉ `contact_id`.

## Chưa kiểm chứng

- Giao diện chưa xem trực tiếp: local không có Postgres của zalobot. Sau khi deploy cần mở hồ sơ Diệu Hằng trên prod: mong đợi 2 giao dịch, tổng chi 459.620 ₫, cột Người tạo, dòng mô tả phạm vi; kiểm tra thêm 375px và dark mode.

## Ghi chú

- Cây làm việc đang có thay đổi của một phiên khác (`apps/api/src/zca/*`, `zalo-plain-text.util*`, `zalo-response-layout.md`, `global/README.md`, artifacts `zalo-plain-text-replies`, `google-photos-duplicate-albums`). Không thuộc task này, không chỉnh sửa. Khi commit chỉ thêm các file liệt kê ở bảng trên.
