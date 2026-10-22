# Kế hoạch: Trang hồ sơ chung (Người liên quan + người dùng Zalo đã liên kết)

Rủi ro: **HIGH** (thêm cột DB + migration, API mới, contracts, trang web mới).

## 1. Quyết định thiết kế

### 1.1. Gốc của hồ sơ là **Người liên quan** (`debt_contacts`)

- Theo `CONTEXT.md`, mỗi người dùng Zalo gắn với **tối đa một** Người liên quan (Liên kết tài khoản). Vì vậy "hồ sơ chung" = một Người liên quan + người dùng Zalo đã gắn với họ (nếu có), quan hệ 1–1.
- Khoản nợ và giao dịch đều đã có `contact_id`, nên lấy lịch sử từ Người liên quan là tự nhiên.
- Người dùng Zalo chưa có Người liên quan thì chưa có hồ sơ. Từ trang `/zca`, admin bấm "Tạo hồ sơ" thì hệ thống tạo Người liên quan gắn với người dùng đó (dùng luồng tạo + liên kết hiện có), rồi mở hồ sơ.
- Không sửa thông tin người dùng Zalo (vai trò, quyền, SĐT tài khoản) trên trang hồ sơ: phần đó chỉ hiển thị và có link sang `/zca`, nơi sửa như hiện nay. Lý do: tránh hai chỗ sửa cùng một dữ liệu.

### 1.2. Dữ liệu mới lưu ở đâu

Thêm cột vào `debt_contacts` (không tạo bảng mới):

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `notes` | `text` null | Ghi chú tự do (tính cách, cách đòi nợ, lưu ý…) |
| `birthday` | `date` null | Ngày sinh |
| `address` | `varchar` null | Địa chỉ |
| `workplace` | `varchar` null | Nơi làm việc |
| `relationship` | `varchar` null | Quan hệ: `family` / `friend` / `colleague` / `partner` / `other` |
| `extra_phones` | `jsonb` not null default `'[]'` | SĐT phụ: `[{ value, label? }]` |
| `extra_bank_accounts` | `jsonb` not null default `'[]'` | Tài khoản phụ: `[{ accountNumber, bankName?, bankCode?, label? }]` |

- SĐT và tài khoản **chính** vẫn là các cột cũ (`phone_number`, `bank_*`). Bot, đồng bộ SĐT với người dùng Zalo và bảng `/contacts` vẫn dùng cột chính, không đổi hành vi. Danh sách phụ chỉ để lưu thêm.
- Chọn `jsonb` thay vì bảng con vì danh sách ngắn, luôn đọc/ghi cùng hồ sơ, không cần tra cứu theo số phụ. Giới hạn: tối đa 10 SĐT phụ, 10 tài khoản phụ.
- Nhật ký kiểm toán: `audit-log.subscriber` đang ghi mọi update entity, nên các cột mới tự có dữ liệu trước/sau.

### 1.3. Gộp Người liên quan (combine) phải giữ dữ liệu mới

Hiện `combineContacts` giữ dòng chính và xoá dòng phụ. Bổ sung (hàm thuần, có unit test):
- Các trường đơn (`birthday`, `address`, `workplace`, `relationship`): dòng chính trống thì lấy từ dòng phụ đầu tiên có giá trị; **không ghi đè**.
- `notes`: nối ghi chú của dòng phụ vào cuối, mỗi đoạn có dòng đầu `— Gộp từ <tên>:`.
- `extra_phones` / `extra_bank_accounts`: hợp nhất, bỏ trùng. SĐT/tài khoản **chính** của dòng phụ, nếu khác của dòng chính, được đưa vào danh sách phụ để không mất.

## 2. API (`apps/api/src/finance`)

| Endpoint | Mô tả |
| --- | --- |
| `GET /api/contacts/:id/profile` | Hồ sơ: thông tin Người liên quan + các trường mới, người dùng Zalo đã gắn (`id`, `username`, `firstName`, `avatarUrl`, `phoneNumber`, `role`, `grantAccess`), tóm tắt số liệu, danh sách khoản nợ, 50 giao dịch gần nhất |
| `PATCH /api/contacts/:id/profile` | Sửa **chỉ** các trường hồ sơ mới. Trường không gửi = giữ nguyên; `null`/chuỗi rỗng = xoá |

- Tách endpoint PATCH riêng thay vì mở rộng `PATCH /api/contacts/:id`, vì endpoint cũ bắt buộc `displayName` và **xoá** `alias`/`descriptor` khi không gửi; đụng vào dễ làm hỏng bảng `/contacts` và bot.
- Tên, biệt danh, mô tả, SĐT/tài khoản chính và liên kết tài khoản trên trang hồ sơ vẫn sửa qua `PATCH /api/contacts/:id` hiện có, gửi đủ trường như bảng `/contacts` đang làm.
- Tóm tắt (`summary`): tổng **Số còn lại** của khoản phải thu đang mở, tổng của khoản phải trả đang mở, số khoản nợ, tổng thu, tổng chi, số giao dịch (toàn bộ giao dịch có `contact_id`, không giới hạn 50).
- Validate dùng chung với web qua contracts (xem mục 3). Lỗi → `400` kèm mã lỗi theo trường.
- Quyền: như các API contacts hiện có (mọi người dùng đã đăng nhập dashboard, sổ chung). Trường `role`/`grantAccess` của người dùng gắn kèm chỉ trả về khi người gọi là admin.
- Logic tính tóm tắt và gộp danh sách là hàm thuần trong file riêng (`contact-profile.ts`), service chỉ lo I/O; có spec.

## 3. Contracts (`packages/contracts`)

- `API_ROUTES.contactProfile(id)`; `APP_ROUTES.contactProfile(id)` → `/contacts/profile?id=<id>`.
- Kiểu: `ContactRelationship`, `IContactPhoneEntry`, `IContactBankAccountEntry`, `IContactProfile`, `IContactProfileSummary`, `IContactProfileResponse`, `IUpdateContactProfileRequest`, `CONTACT_PROFILE_LIMITS`.
- `validateContactProfileUpdate(dto)`: trim; ngày sinh `YYYY-MM-DD` hợp lệ và không ở tương lai; `relationship` thuộc danh sách; SĐT phụ chỉ chữ số/`+`/khoảng trắng, 8–15 chữ số; số tài khoản 6–20 chữ số; độ dài ghi chú ≤ 5000; bỏ dòng trống; giới hạn số phần tử.
- Chuỗi i18n `contacts.profile.*` (vi/en).

## 4. Web

### 4.1. Định tuyến

Web build dạng static export nên **không dùng được route động** `/contacts/[id]`. Trang mới là `app/(private)/contacts/profile/page.tsx`, đọc `?id=` bằng `useSearchParams` trong `<Suspense>` (giống `transactions/page.tsx`).

### 4.2. Bố cục trang (phẳng, vuông, theo chuẩn bảng vừa làm)

```
[← Người liên quan]  Avatar vuông  Tên (biệt danh) · mô tả             [Sửa]
                     Zalo: Tên @username · Admin/Đã cấp → mở /zca
──────────────────────────────────────────────────────────────────────
Đang cho vay còn lại | Đang nợ còn lại | Tổng thu | Tổng chi      (dải số liệu)
──────────────────────────────────────────────────────────────────────
Thông tin (cột trái ~360px)          | Khoản nợ (DataTable)
  SĐT chính + SĐT phụ (nhãn)         |   hướng, số tiền, số còn lại, trạng thái, ngày
  Tài khoản chính + phụ              | Giao dịch gần đây (DataTable, 50 dòng)
  Ngày sinh · Quan hệ                |   ngày, loại, số tiền, danh mục, ghi chú
  Địa chỉ · Nơi làm việc             |   + link "Xem tất cả" → /transactions
  Ghi chú (nhiều dòng)               |
```

- Mobile: các khối xếp dọc; bảng dùng chế độ danh sách mobile sẵn có của `DataTable`.
- Số tiền tôn trọng nút ẩn/hiện số tiền (mặc định ẩn mỗi lần tải trang).
- Sửa: bấm **Sửa** thì khối Thông tin chuyển thành form tại chỗ (thêm/xoá dòng SĐT và tài khoản phụ), **Lưu** / **Huỷ**; lỗi hiện dưới từng trường. Không mở modal.
- 4 trạng thái: đang tải (skeleton), lỗi + Thử lại, không tìm thấy (id sai/đã xoá hoặc đã bị gộp), có dữ liệu. Danh sách nợ/giao dịch rỗng thì hiện dòng trống.
- Không dùng chip/pill hay emoji trong ô; nút vuông `h-[22px] rounded-[2px]`.

### 4.3. Lối vào

- Bảng `/contacts`: thêm nút **Hồ sơ** ở cột Thao tác (cạnh Sửa). Không dùng click vào tên, vì nhấp đúp vào tên đang dùng để sửa tại chỗ.
- Bảng `/zca`, menu `⋯` của dòng người dùng: **Xem hồ sơ** (đã có Người liên quan gắn) hoặc **Tạo hồ sơ** (admin, chưa có), tạo rồi mở luôn.

### 4.4. Code

- `modules/contacts/api`: `getContactProfile`, `updateContactProfile`; query key `contactsQueryKeys.profile(id)`; mutation invalidate `profile(id)` và `list()`.
- `modules/contacts/model/contact-profile-form.ts`: chuyển DTO ↔ dữ liệu form (hàm thuần, có spec).
- `modules/contacts/view/contact-profile-screen.tsx` + các component con trong `presentation/components/` (header, dải số liệu, khối thông tin xem/sửa, bảng nợ, bảng giao dịch).

## 5. Migration

`AddProfileFieldsToDebtContacts`: thêm 7 cột ở mục 1.2; `down` xoá 7 cột. Chỉ thêm cột nullable/có default, không đụng dữ liệu cũ.

## 6. Tài liệu

- `.agents/knowledge/modules/contacts/README.md` (EN) và `.agents/docs/modules/contacts/README.md` (VI): mục Hồ sơ (dữ liệu, API, quy tắc gộp, lối vào, bố cục).
- `.agents/knowledge/modules/zca/README.md` + docs VI: mục menu `⋯` có Xem/Tạo hồ sơ.
- `CONTEXT.md`: thêm thuật ngữ **Hồ sơ** (Người liên quan + người dùng Zalo đã gắn).
- `docs-drift-check` phải qua cho các module của task này.

## 7. Kiểm tra

- Unit test: validate contracts, gộp hồ sơ khi combine, tính tóm tắt, chuyển form.
- `npm run typecheck`, `npm run lint`, `npm run test` cho `api`, `web`, `contracts`; `npm run build --workspace @zalobot/web` (kiểm tra static export với trang mới).
- Migration chỉ được kiểm tra bằng typecheck/review vì máy không chạy Postgres. Ghi rõ là chưa chạy thật.

## 8. Ngoài phạm vi

- Bot đọc/ghi ghi chú hồ sơ qua chat.
- Tra cứu Người liên quan theo SĐT phụ.
- Avatar upload; lịch sử thay đổi hiển thị trên trang (đã có trong nhật ký kiểm toán).
