# Kế Hoạch Nâng Cấp Hệ Thống Bảng CSDL & Entity Toàn Diện (Database Schema & Entities Upgrade)

Tài liệu này mô tả chi tiết phương án nâng cấp toàn bộ hệ thống bảng cơ sở dữ liệu SQLite (thông qua TypeORM Entities), cập nhật DTO contracts dùng chung (`@zalobot/contracts`), bổ sung logic xử lý backend và đồng bộ giao diện Web Dashboard.

## User Review Required

> [!IMPORTANT] **Tự động migrate SQLite**: TypeORM đang bật `synchronize: true` trong môi trường local, do đó việc thêm cột mới có giá trị mặc định (`nullable: true` hoặc `default: ...`) sẽ **không làm mất dữ liệu hiện có** trong `data/zalobot.sqlite`.
>
> Bảng mới `debt_payments` sẽ được tự động khởi tạo để hỗ trợ theo dõi lịch sử từng lần trả nợ lẻ (thay vì chỉ ghi đè `remainingAmount`).

## Proposed Changes

---

### 1. Shared Contracts (`packages/contracts`)

#### [MODIFY] index.ts

- Bổ sung interface và type cho `IDebtPaymentItem`, `ICreateDebtPaymentRequest`.
- Mở rộng `IContactListItem`, `IUpdateContactRequest`: thêm `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`, `avatarUrl`, `updatedAt`.
- Mở rộng `IDebtListItem`, `CreateDebtDto`: thêm `settledAt`, `currency`, `updatedAt`.
- Mở rộng `IExpenseListItem`, `ICreateTransactionRequest`: thêm `paymentMethod`, `currency`, `receiptUrl`, `contactId`, `updatedAt`.
- Mở rộng `ICreateReminderRequest`: thêm `status`, `snoozedUntil`, `snoozeCount`.
- Bổ sung translation keys song ngữ (`vi` & `en`) cho các nhãn cột và thông tin mới (STK, Ngân hàng, SĐT, Nguồn tiền, Lịch sử trả nợ).

---

### 2. Database Entities & Module (`apps/api/src/database`)

#### [NEW] debt-payment.entity.ts

- Định nghĩa entity `DebtPaymentEntity` (`debt_payments` table):
  - `id`: UUID PK
  - `debtId`: UUID FK liên kết với `debts.id`
  - `userId`: varchar index
  - `amount`: integer (số tiền đã trả trong đợt này)
  - `paymentDate`: datetime (ngày trả)
  - `note`: varchar nullable (ghi chú lần trả nợ)
  - `createdAt`: datetime

#### [MODIFY] debt.entity.ts

- Bổ sung quan hệ `OneToMany` tới `DebtPaymentEntity`.
- Thêm `settledAt`: datetime nullable (thời điểm tất toán hoàn toàn).
- Thêm `currency`: varchar default `'VND'`.
- Thêm `updatedAt`: UpdateDateColumn.

#### [MODIFY] debt-contact.entity.ts

- Thêm `phoneNumber`: varchar nullable.
- Thêm `bankAccountNumber`: varchar nullable (STK nhận tiền / chuyển khoản).
- Thêm `bankCode`: varchar nullable (mã ngân hàng, vd `VCB`, `TCB`, `MB`).
- Thêm `bankName`: varchar nullable (tên ngân hàng).
- Thêm `avatarUrl`: varchar nullable.
- Thêm `updatedAt`: UpdateDateColumn.

#### [MODIFY] finance-transaction.entity.ts

- Thêm `currency`: varchar default `'VND'`.
- Thêm `paymentMethod`: varchar nullable (tiền mặt, ví, ngân hàng).
- Thêm `receiptUrl`: varchar nullable (link ảnh hóa đơn OCR).
- Thêm `contactId`: varchar nullable index (người cùng chi tiêu / liên quan).
- Thêm `updatedAt`: UpdateDateColumn.

#### [MODIFY] reminder.entity.ts

- Thêm `status`: `'pending' | 'completed' | 'snoozed' | 'cancelled'` (default `'pending'`).
- Thêm `snoozeCount`: integer default `0`.
- Thêm `snoozedUntil`: datetime nullable.
- Thêm `completedAt`: datetime nullable.
- Thêm `updatedAt`: UpdateDateColumn.

#### [MODIFY] user.entity.ts

- Thêm `timezone`: varchar default `'Asia/Ho_Chi_Minh'`.
- Thêm `phoneNumber`: varchar nullable (phục vụ tính năng gọi điện nhắc nhở CallMe).
- Thêm `avatarUrl`: varchar nullable.
- Thêm `status`: `'active' | 'suspended'` default `'active'`.

#### [MODIFY] database.module.ts

- Import và đăng ký `DebtPaymentEntity` vào `TypeOrmModule.forRootAsync` và `TypeOrmModule.forFeature`.

---

### 3. Backend Services (`apps/api/src`)

#### [MODIFY] finance.service.ts

- Inject thêm `debtPaymentRepo: Repository<DebtPaymentEntity>`.
- Triển khai phương thức `recordDebtPayment(dto: CreateDebtPaymentDto)`:
  - Kiểm tra khoản nợ tồn tại.
  - Ghi nhận bản ghi `debt_payments`.
  - Cập nhật trừ lùi `remainingAmount`. Nếu `remainingAmount <= 0`, set `status = 'settled'` và `settledAt = new Date()`.
- Cập nhật `createTransaction` để nhận `paymentMethod`, `currency`, `receiptUrl`, `contactId`.
- Cập nhật `updateContact` để cập nhật `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`.

#### [MODIFY] reminders.service.ts

- Cập nhật logic `snoozeReminder` để lưu `snoozedUntil = new Date(Date.now() + 15 * 60 * 1000)`, tăng `snoozeCount += 1`, đặt `status = 'snoozed'`.
- Cập nhật logic hoàn thành nhắc nhở đặt `status = 'completed'` và `completedAt = new Date()`.

---

### 4. Frontend UI Components (`apps/web`)

#### [MODIFY] contacts-screen.tsx

- Thêm các cột tuỳ chọn trong `DataTable`: Số điện thoại, STK Ngân hàng, Ngân hàng.
- Cập nhật modal chỉnh sửa và gộp liên hệ hỗ trợ điền STK / Số điện thoại.

#### [MODIFY] debts-screen.tsx

- Thêm hiển thị trạng thái tất toán và nút xem lịch sử các lần trả nợ.

#### [MODIFY] expenses-screen.tsx

- Thêm cột Phương thức thanh toán (`paymentMethod`) và Tiền tệ (`currency`).

---

## Verification Plan

### Automated Tests & Quality Gates

- Chạy kiểm tra kiểu dữ liệu toàn bộ monorepo:
  ```bash
  npm run typecheck
  ```
- Chạy linter & format:
  ```bash
  npm run lint:check
  ```
- Chạy kiểm tra hệ thống agent:
  ```bash
  npm run agent-system:validate
  ```
- Kiểm tra tính toàn vẹn dữ liệu SQLite sau khi khởi động TypeORM:
  ```bash
  node -e "const Database = require('better-sqlite3'); const db = new Database('data/zalobot.sqlite'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all());"
  ```

### Manual Verification

- Kiểm tra tạo mới transaction với `paymentMethod` và `currency`.
- Kiểm tra tạo khoản nợ, thực hiện trả nợ 1 phần, xác nhận bản ghi trong `debt_payments` và số dư còn lại trong `debts`.
- Kiểm tra cập nhật thông tin liên hệ (SĐT, STK) và hiển thị trên giao diện Web Dashboard.
