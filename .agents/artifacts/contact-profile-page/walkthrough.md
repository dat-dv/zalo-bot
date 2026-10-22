# Walkthrough: Trang hồ sơ chung

## Đã làm (theo `implementation_plan.md`)

### Contracts (`packages/contracts/src/index.ts`)
- `API_ROUTES.contactProfile(id)`, `APP_ROUTES.contactProfilePage`, `APP_ROUTES.contactProfile(id)` (`/contacts/profile?id=`).
- Kiểu `ContactRelationship`, `IContactPhoneEntry`, `IContactBankAccountEntry`, `IContactProfileFields`, `IContactProfileLinkedUser`, `IContactProfile`, `IContactProfileSummary`, `IContactProfileResponse`, `IUpdateContactProfileRequest`, `CONTACT_PROFILE_LIMITS`, mã lỗi.
- `validateContactProfileUpdate` (dùng chung API + web), `contactDigits`, `isContactRelationship`.
- Chuỗi i18n `contacts.profile.*`, `contacts.actions.profile`, `zca.profile.*` (vi/en).

### API
- Migration `1724850000000-AddProfileFieldsToDebtContacts` (7 cột, đăng ký ở `data-source.ts` và `database.module.ts`); entity `DebtContactEntity` thêm cột.
- `finance/contact-profile.ts`: `toContactProfile`, `toProfileDebtItem`, `summarizeContactProfile`, `mergeContactProfileFields` (+ `contact-profile.spec.ts`, 8 test).
- `FinanceService.getContactProfile`, `updateContactProfile`; `combineContacts` gọi `mergeContactProfileFields`.
- `FinanceController`: `GET` / `PATCH /api/contacts/:id/profile`.

### Web
- `contacts-api.ts`: `createContact`, `getContactProfile`, `updateContactProfile`; `contacts-query.ts`: key `profile(id)`, `useContactProfileQuery`, `useSaveContactProfileMutation`.
- `model/contact-profile-form.ts` (+ spec, 5 test).
- `view/contact-profile-screen.tsx`, `view/use-open-contact-profile.ts`, `presentation/components/contact-profile/*`, route `app/(private)/contacts/profile/page.tsx`, tiêu đề trong `workspace-header.tsx`.
- Lối vào: nút **Hồ sơ** ở bảng `/contacts`; **Xem/Tạo hồ sơ** trong menu `⋯` của `/zca` (`chat-table-row.tsx`).

### Tài liệu
- `knowledge/modules/contacts/README.md`, `docs/modules/contacts/README.md`, `knowledge|docs/modules/zca/README.md` (mục menu), `knowledge|docs/global/finance-domain.md`, `CONTEXT.md` (thuật ngữ **Hồ sơ**).

## Kiểm tra

- `typecheck` api + web: qua. `lint` api + web: qua.
- `test` api: 497/497 qua; web: 48/48 qua.
- `npm run build --workspace @zalobot/web`: qua, `/contacts/profile` được prerender tĩnh.
- `docs-drift-check`: PASS.
- **Chưa chạy thật**: migration và API trên Postgres (máy không chạy DB), giao diện chưa xem trên trình duyệt.

## Lưu ý khi commit

Working tree đang có thay đổi của các phiên khác (mobile-friendly-pages, zca thread config/directory cache). `.agents/knowledge/modules/zca/README.md` có thêm một dòng `DELETE /api/zca/thread-configs/:threadId` không thuộc task này; cần tách riêng khi commit.
