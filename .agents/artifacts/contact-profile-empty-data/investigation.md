# Chẩn đoán: Trang hồ sơ người liên quan hiển thị trống

- Ngày: 2026-10-23
- Route: investigate · Authority: propose-only
- Môi trường: prod `zalobot.datintech.site`, hồ sơ `Diệu Hằng` (`contactId 2cf929ff-48f7-4fbc-9014-98269243ce8e`, user Zalo `5369142156728714489`)

## Hiện tượng

Trang `/contacts/profile?id=…` hiện đúng tên, avatar, "Tài khoản Zalo: Diệu Hằng · Đã cấp quyền", nhưng:
- 4 ô tổng (cho vay / đang nợ / tổng thu / tổng chi) = 0 ₫, "0 khoản đang mở · 0 giao dịch".
- Thông tin (SĐT, tài khoản, ngày sinh, quan hệ, địa chỉ, nơi làm việc, ghi chú) trống.
- Bảng khoản nợ và giao dịch: "Chưa có…".

Người dùng nghi trang chưa nối API.

## Kết luận

**Trang đã nối API đầy đủ và hiển thị đúng dữ liệu backend trả về.** Dữ liệu trống vì:

1. **Giao dịch (nguyên nhân chính, lỗ hổng thiết kế):** hồ sơ chỉ lấy giao dịch theo `transactions.contact_id` (người liên quan/đối tác của giao dịch). Trong ứng dụng **không có luồng nào ghi `contact_id` cho giao dịch**: tool ghi thu chi của bot không truyền, form giao dịch trên dashboard không có ô chọn người liên quan. Vì vậy cả 27 giao dịch trên prod đều không gắn người liên quan. 2 giao dịch Diệu Hằng **tự ghi** (459.620 ₫) chỉ gắn qua `created_by_user_id`, mà hồ sơ không truy vấn theo cột này.
2. **Khoản nợ:** prod hiện có **0 khoản nợ** trong toàn hệ thống → trống là đúng.
3. **Thông tin:** contact được tạo hàng loạt bởi "Đồng bộ người dùng Zalo" (cả 3 contact cùng `createdAt 2026-10-20T09:05:29.604Z`), chỉ có tên và liên kết. Zalo ẩn SĐT nên `phoneNumber` của cả contact lẫn user Zalo đều `null`. Ngày sinh, quan hệ, địa chỉ… là dữ liệu nhập tay qua nút "Sửa", chưa ai nhập.

Độ tin cậy: **cao** (đã đối chiếu response API thật trên prod với code).

## Bằng chứng

| # | Nguồn | Quan sát |
| --- | --- | --- |
| 1 | `apps/web/src/modules/contacts/api/contacts-api.ts` → `getContactProfile` | Gọi `GET API_ROUTES.contactProfile(id)` = `/api/contacts/:id/profile` qua `useContactProfileQuery`. |
| 2 | `apps/api/src/finance/finance.service.ts:1221` `getContactProfile` | Nợ: `where { contactId: id, parentDebtId: IsNull() }`; giao dịch: `where { contactId: id }`; tổng: `t.contact_id = :id`. Không dùng `linkedUserId` / `createdByUserId`. |
| 3 | Network prod: `GET /api/contacts/2cf929ff…/profile → 200` | `summary` toàn 0, `debts: []`, `recentTransactions: []`, `phoneNumber` không có, `linkedUser.phoneNumber: null`, các trường hồ sơ `null`. UI hiển thị khớp 100%. |
| 4 | Network prod: `GET /api/contacts → 200` | 3 contact (Bot Finance Assistance, Diệu Hằng, Văn Đạt), tất cả `debtCount: 0`, `transactionCount: 0` (đếm theo `contact_id IS NOT NULL`). |
| 5 | Prod: `GET /api/debts` | 0 khoản nợ. |
| 6 | Prod: `GET /api/transactions` | 27 giao dịch. Theo người tạo: `2285509137317769272` 9 (1.089.000 ₫), Văn Đạt 12 (687.000 ₫), Bot Finance Assistance 3 (38.000 ₫), **Diệu Hằng 2 (459.620 ₫)**, `effcda10…` 1. Không giao dịch nào gắn người liên quan (khớp #4). |
| 7 | `finance.service.ts:334` (`createTransaction`) | `contactId: dto.contactId \|\| undefined` — chỉ có khi caller truyền. |
| 8 | `grep contactId` trong `apps/api/src/zca`, `apps/api/src/llm`, `apps/web/src` | Bot chỉ gán `contactId` cho **khoản nợ** (`manage-debt-tool.strategy.ts:118`). Web chỉ gửi `contactId` ở module debts/contacts/users, **không có** ở module giao dịch. |
| 9 | `.agents/knowledge/modules/contacts/README.md` (mục Profile page) | Giả định "Debts and transactions already carry `contact_id`" — đúng với nợ, nhưng với giao dịch thì cột tồn tại mà thực tế không bao giờ được ghi. |

## Phạm vi ảnh hưởng

- Mọi hồ sơ: phần "Giao dịch gần đây", "Tổng thu", "Tổng chi", "N giao dịch" sẽ luôn = 0 cho tới khi có luồng ghi `transactions.contact_id`.
- Phần khoản nợ hoạt động đúng khi có nợ (bot và form nợ đều gắn `contactId`).
- Cột "Giao dịch" trên trang `/contacts` và badge giao dịch trong hộp thoại gộp người liên quan cũng luôn 0 vì cùng nguyên nhân.

## Xung đột quy tắc nghiệp vụ cần anh quyết

`CONTEXT.md` → **Người tạo**: "Chỉ để hiển thị, không dùng để lọc dữ liệu." Hiển thị "giao dịch do người này ghi" trên hồ sơ là lọc theo người tạo, nên phương án A dưới đây cần anh chấp nhận nới quy tắc này (chỉ cho trang hồ sơ, ở dạng tham khảo, không phải sổ riêng).

## Đề xuất khắc phục

### A. Hồ sơ hiện thêm giao dịch do user Zalo đã liên kết ghi *(khuyến nghị, nhỏ nhất)*

- Backend `getContactProfile`: nếu contact có `linkedUserId`, lấy thêm giao dịch `created_by_user_id = linkedUserId` (giới hạn `RECENT_TRANSACTIONS`) và tổng theo loại.
- Response thêm trường riêng (vd. `recordedTransactions`, `summary.recordedCount/recordedExpenseTotal/recordedIncomeTotal`), giữ nguyên `recentTransactions` theo `contact_id` để không đổi nghĩa "giao dịch với người này".
- Web: thêm bảng "Giao dịch do <tên> ghi" (hoặc gộp một bảng với cột "Vai trò": Người tạo / Người liên quan) và chỉ số tương ứng.
- Cập nhật `CONTEXT.md` (định nghĩa Hồ sơ + ngoại lệ của Người tạo), knowledge `modules/contacts`, docs `modules/contacts`.
- Test: spec cho `summarizeContactProfile` mở rộng + spec service với contact có/không có `linkedUserId`.

### B. Cho phép gắn giao dịch với người liên quan *(lớn hơn, đúng nghĩa "giao dịch với người này")*

- Form giao dịch dashboard: thêm ô chọn người liên quan.
- Tool ghi thu chi của bot: thêm tham số người liên quan (vd. "trả Hằng 50k"), tra cứu danh bạ bằng khóa chuẩn hoá như nợ.
- Không sửa được dữ liệu cũ tự động (27 giao dịch hiện tại không biết đối tác là ai).
- Có thể làm cùng A.

### C. Chỉ làm rõ trạng thái trống *(rẻ nhất)*

- Đổi câu trống thành giải thích: "Chưa có giao dịch nào gắn với người này. Giao dịch do họ tự ghi không hiện ở đây." và gợi ý bấm "Sửa" để nhập SĐT/thông tin.

## Kiểm chứng sau khi sửa

- Mở hồ sơ Diệu Hằng trên prod: phải thấy 2 giao dịch / 459.620 ₫ (A).
- `npm run test --workspace @zalobot/api`, `npm run typecheck`, `npm run lint`.
- `node .claude/hooks/docs-drift-check.mjs` exit 0.
