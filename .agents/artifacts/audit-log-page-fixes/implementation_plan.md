# Implementation Plan: Sửa 5 điểm của trang Nhật ký hoạt động

- Ngày: 2026-10-23
- Route: implement · Phase 1 (inspect-and-plan) · **Chờ anh duyệt**
- Mức rủi ro: **TRUNG BÌNH** (chủ yếu là web; có 1 cột DB mới nullable ở điểm 3B)
- Nguồn: kiểm tra trên production v1.0.175 (lượt trước), nền tảng: [audit-log-page](../audit-log-page/implementation_plan.md)
- Code hiện tại: `main` = `0c421c9` (v1.0.176, đã merge nhắc lặp/nhắc lại). Migration mới nhất `1724960000000`.

## 1. Nút "Xem" bị đẩy ra ngoài màn hình ở desktop

**Nguyên nhân:** ở viewport 1280px, khung bảng rộng 1020px nhưng bảng cần 1167px:

- Cột hệ thống STT 56px; cột ID ~287px vì UUID đầy đủ quyết định độ rộng.
- Các cột của trang: thời điểm 140, người 200, dữ liệu 220, trường đổi 200, thao tác 59.

Cột ID là quy ước chung của mọi `DataTable` (bắt buộc, không ẩn được), nên không sửa ở đây.

**Cách sửa** (`audit-table.tsx`):

- Biến nội dung ô **Dữ liệu** ("Sửa · Giao dịch thu chi …f05b") thành nút mở hộp thoại chi tiết.
  - Chữ màu sky, gạch chân khi hover, `title` = `audit.viewTitle`, `aria-label` kèm hành động và loại dữ liệu.
  - Đây là lối vào chính, luôn nằm trong vùng nhìn thấy.
- Giữ cột "Xem" ở cuối, vì sheet trên điện thoại dùng cột `actions` làm nút ở chân sheet.
- Thu hẹp `minWidth`: thời điểm 140→130, người 200→180, dữ liệu 220→200, trường đổi 200→160.
- **Kết quả mong đợi:**
  - Từ ~1360px: thấy đủ cả cột "Xem".
  - Ở 1280px: cột "Xem" có thể vẫn phải cuộn ngang, nhưng bấm ô Dữ liệu là mở được chi tiết.

## 2. Hết phiên thì không hiện form đăng nhập

**Nguyên nhân:** `ActivityScreen` coi 401 như lỗi chung ("Không thể tải nhật ký"). Các trang Tổng quan, Thu chi, Phân tích thì trả `SessionStateScreen` (có form đăng nhập bằng mã).

**Cách sửa:**

- `audit-query.ts`:
  - Thêm `isUnauthorizedError` (401).
  - Không retry khi gặp 401 hoặc 403.
- `activity-screen.tsx` xử lý theo thứ tự:
  1. 403 → `ZcaAdminOnlyNotice` (như cũ).
  2. 401 → `<SessionStateScreen reason="expired" onRetry={() => void logs.refetch()} />`, giống `TransactionsScreen`.
  3. Lỗi khác (mạng, 500) → giữ thông báo lỗi + Thử lại.

## 3. Tên người thực hiện hiện "Chưa rõ tên (…xxxx)"

**Nguyên nhân:** nhật ký chỉ lấy tên từ `users.firstName`. Thẻ phiên (`UsersService.getSessionProfile`) thì lấy tên Zalo từ danh bạ ZCA trước (`alias || name || displayName`, đọc cache Redis, không gọi Zalo), rồi mới tới `firstName`. Với thành viên nhóm không kết bạn với bot, danh bạ cũng không có tên.

**A. Tra tên lúc đọc, giống thẻ phiên (không đổi DB):**

- `UsersService.resolveZaloNames(ids: string[]): Promise<Map<string, string>>`: chỉ lấy tên từ danh bạ ZCA (`getAvailableThreads(false)`, mục loại `user`), lỗi thì trả map rỗng.
- `AuditService.list/get` nhận thêm tham số tuỳ chọn `resolveNames?: AuditNameResolver`.
  - `AuditController` truyền `(ids) => this.users.resolveZaloNames(ids)`. Controller nằm trong `AuditAdminModule`, module đã import `UsersModule`, nên không tạo vòng import.
- Thứ tự ưu tiên tên: **danh bạ ZCA → tên đã lưu lúc ghi nhật ký (3B) → `users.firstName`** → fallback hiện tại. Áp cho cả danh sách người trong bộ lọc.

**B. Lưu tên người gửi ngay lúc ghi nhật ký (cho thành viên nhóm không kết bạn):**

- Migration `1724970000000-AddAuditLogActorName`: `ADD COLUMN IF NOT EXISTS "actor_name" varchar`, nullable, không backfill.
- `AuditContextStore.actorName?`. `zaloAuditContext(senderId, channelId, senderName?)` lấy `message.data.dName` / `reaction.data.dName`, ids bỏ khoảng trắng.
- `processConfirm`: chỉ giữ tên khi người đang xác nhận cũng là người yêu cầu (`current.actorId === pending.userId`), nếu không thì không gán tên. Lý do: `PendingAction` không lưu tên người yêu cầu, và không được gán nhầm tên người duyệt.
- Subscriber ghi `actorName: context?.actorName ?? null`. Dashboard không cần, vì tên tra được qua danh bạ hoặc `users`.
- Danh sách người trong bộ lọc lấy tên đã lưu mới nhất của mỗi người: `GROUP BY actor_id` + `MAX(actor_name)`.
- Tiền lệ: giao dịch cũng lưu sẵn `createdByName` để hiển thị.

## 4. Khối "Hoạt động gần đây" ở trang chủ còn nhãn thô

**Nguyên nhân:**

- `GET /api/dashboard` trả `action`/`tableName` thô, và web in thẳng ra (`insert · dashboard_exchange_tokens`).
- `listRecent` không loại bảng kỹ thuật, nên các lần đăng nhập/làm mới token chiếm chỗ.

**Cách sửa:**

- API: `AuditService.listRecent` loại `AUDIT_TECHNICAL_TABLES`, giống mặc định của trang `/activity`.
- Contracts: `IDashboardData.activity[].action` đổi từ `string` sang `AuditAction`. Backend vốn đã gửi đúng các giá trị này.
- Web (`dashboard-home-screen.tsx`):
  - Hiển thị `t(AUDIT_ACTION_LABEL_KEYS[action]) · describeAuditTable(tableName, t)` (import từ `@/modules/audit/model/audit-labels`), cả trên desktop lẫn danh sách điện thoại. Hành động có màu như trang `/activity`.
  - Ô tìm kiếm của khối lọc theo nhãn đã dịch, không theo tên bảng thô.

## 5. Hàng bộ lọc quá dài trên điện thoại

**Nguyên nhân:** 7 control trong một hàng cuộn ngang rộng 1247px, khung chỉ 317px; riêng ô "Dữ liệu" đã 263px.

**Cách sửa** (theo mẫu bottom sheet đang dùng):

- Tách `AuditFilterFields` (các control) ra khỏi `AuditFilters`, có hai kiểu bố cục: `row` (desktop) và `stack` (sheet).
- **Điện thoại** (`useIsPhone()`): thanh công cụ chỉ còn một hàng ngắn:
  - Chip **Bộ lọc** (32px, kèm số bộ lọc đang bật, ví dụ "Bộ lọc · 2").
  - Chip mã bản ghi (✕ để bỏ) khi có.
  - "Xoá bộ lọc" khi có bộ lọc.
- Chạm chip **Bộ lọc** mở `Modal` dạng sheet "Lọc nhật ký":
  - Các control xếp dọc, full width, cao 40px (`TAP_INPUT`, theo quy ước "sheet/dialog giữ kích thước chạm 40px").
  - Thay đổi áp dụng ngay, như trên desktop. Nút **Xong** đóng sheet.
- **Desktop** giữ nguyên hàng hiện tại.
- Model: `countActiveAuditFilters(state)`, đếm bảng/hành động/nguồn/người/từ/đến/kỹ thuật, không tính mã bản ghi vì nó có chip riêng. Kèm spec.
- i18n vi/en: `audit.filter.open` ("Bộ lọc"), `audit.filter.openCount` ("Bộ lọc · {count}"), `audit.filter.sheetTitle` ("Lọc nhật ký"), `audit.filter.done` ("Xong").

## 6. Các bước (Phase 2, sau khi anh duyệt)

1. Contracts: i18n mới; `activity[].action: AuditAction`.
2. Web điểm 2 (401) và điểm 1 (ô Dữ liệu bấm được + độ rộng cột).
3. Web điểm 5 (sheet bộ lọc trên điện thoại) + `countActiveAuditFilters` + spec.
4. API + web điểm 4 (`listRecent` loại bảng kỹ thuật, nhãn trên trang chủ).
5. Điểm 3A: `UsersService.resolveZaloNames` + nối vào `AuditService`/`AuditController` + spec.
6. Điểm 3B: migration + entity + ngữ cảnh + `processConfirm` + subscriber + spec.
7. Tài liệu (mục 8), kiểm tra (mục 7).
8. Commit lên `main` + push với version kế tiếp (v1.0.177), **chỉ stage file của task này**. Thư mục `.agents/artifacts/reminder-form-layout/` của phiên khác không đụng tới.

## 7. Kiểm tra

- `npm run typecheck`, `npm run lint`, `npm run test` cho contracts/api/web; `npm run build --workspace @zalobot/web`.
- Spec mới hoặc sửa:
  - `audit-context.spec` (tên người gửi).
  - `audit-log.subscriber.spec` (`actorName`).
  - `transaction-confirmation.service.spec` (giữ tên khi người duyệt là người yêu cầu, bỏ tên khi khác người).
  - `audit.service.spec` (thứ tự ưu tiên tên, `listRecent` loại bảng kỹ thuật).
  - `users-session-profile.spec` hoặc spec mới cho `resolveZaloNames`.
  - `audit-url-state.spec` (`countActiveAuditFilters`).
- `node .claude/hooks/docs-drift-check.mjs --all`.
- Sau deploy, kiểm tra lại trên production bằng browser pane (chỉ xem):
  - 1280px: ô Dữ liệu mở được chi tiết.
  - Điện thoại: chip Bộ lọc và sheet hoạt động.
  - Tên người thực hiện đã hiện.
  - Trang chủ: nhãn tiếng Việt, không còn bảng kỹ thuật.
  - Hết phiên: chỉ kiểm tra được nếu phiên tự hết hạn. Em sẽ **không** tự đăng xuất phiên của anh.

## 8. Tài liệu (Hard Completion Gate)

- `knowledge/modules/audit` + `docs/modules/audit`: ô Dữ liệu mở chi tiết, 401 → màn đăng nhập, thứ tự ưu tiên tên + cột `actor_name`, sheet bộ lọc trên điện thoại.
- `knowledge/modules/dashboard` + `docs/modules/dashboard`: khối Hoạt động dùng nhãn tiếng Việt và không còn bảng kỹ thuật.
- `knowledge/global/backend-runtime-services` + `docs/global/backend-runtime-services`: thêm cột `actor_name`.

## 9. Rủi ro / giới hạn

- **Tên chỉ lưu từ nay**: dòng cũ không có `actor_name`; người không kết bạn với bot và không có `firstName` vẫn hiện "Chưa rõ tên" ở các dòng cũ.
- **Thao tác được người khác duyệt**: dòng ghi lại không có tên lưu sẵn, mà dựa vào danh bạ hoặc `firstName`.
- **Danh bạ ZCA đọc từ cache**: nếu cache trống (ZCA chưa đăng nhập) thì bỏ qua bước này, không gọi Zalo.
- **Cột "Xem" ở 1280px**: có thể vẫn cần cuộn ngang. Muốn hết hẳn thì phải thu gọn cột ID chung của mọi bảng; việc đó ngoài phạm vi, đề xuất làm riêng nếu anh muốn.

## 10. Câu hỏi cần anh chốt (đã có mặc định)

- **Q1**: Làm cả **3B** (lưu tên người gửi Zalo vào nhật ký, cần 1 migration nhỏ)? *Mặc định: có*. Nếu không, chỉ làm 3A (danh bạ ZCA) và thành viên nhóm không kết bạn vẫn hiện "Chưa rõ tên".
- **Q2**: Trên điện thoại, bộ lọc áp dụng **ngay khi đổi** (mặc định), hay chỉ áp khi bấm "Xong"?

## 11. Ngoài phạm vi

- Thu gọn cột ID chung của `DataTable`.
- Clipboard bị ghi khi bấm "Lịch sử bản ghi này" (chưa rõ nguyên nhân, cần điều tra riêng).
- Dữ liệu cũ có `actor_id = "NaN"`.
- Dọn nhật ký định kỳ.
