# Tổng Kết Triển Khai Tính Năng Gộp Công Nợ Cha–Con (Debt Consolidation & Parent–Child Hierarchy)

## 1. Tóm Tắt Mục Tiêu Nghiệp Vụ

Đáp ứng yêu cầu của người dùng:

> _"à mà có thể gom tất cả thành 1 khoản . ví dụ có 2 khoản nợ a và b , chúng ta combine lại thành 1 cái cha là c trong đó có a và b lúc mà thực hiện tính năng combine nhá . các khoản cho vay cũng thế..."_
> _"có chặn validation nó merge sai làm crash app k đó. nhớ có chặn nha"_

Hệ thống cho phép gộp $N \ge 2$ khoản nợ (hoặc cho vay) có cùng chiều (`receivable` với `receivable`, `payable` với `payable`) thành một khoản nợ cha $C$, trong đó:

- Khoản nợ cha $C$ có:
  - `originalAmount = sum(children.originalAmount)`
  - `remainingAmount = sum(children.remainingAmount)`
- Các khoản con $A$ và $B$ được gắn `parentDebtId = C.id`, giữ nguyên toàn bộ lịch sử thanh toán, phân bổ giao dịch thu–chi, hạn chót và ghi chú độc lập.
- Khi gộp danh bạ (`POST /api/contacts/combine`), tùy chọn `consolidateDebts: true` tự động gom các khoản nợ của các liên hệ nguồn thành các khoản nợ cha duy nhất dưới liên hệ đích.
- Trên giao diện Web: Bảng công nợ hỗ trợ chọn nhiều qua checkbox, nút bấm gộp nợ, cây phân cấp mở rộng/thu gọn (`▶ / ▼`) kèm huy hiệu `[Gộp: N khoản con]` và `[Khoản con]`.

---

## 2. Các Cơ Chế Validation & Chống Crash Toàn Diện (Defensive Guards)

Để bảo đảm hệ thống tuyệt đối không bị lỗi, tính toán sai lệch hay crash app khi người dùng hoặc bot thực hiện thao tác gộp:

1. **Chặn Lệch Chiều Nợ (Direction Parity Guard)**:
   - Backend: Kiểm tra `debts.some((d) => d.direction !== direction)` -> quăng lỗi `Chỉ có thể gộp các khoản nợ cùng chiều (cùng Phải thu hoặc cùng Phải trả)`.
   - Frontend `CombineDebtsDialog`: Tự động quét và hiển thị thẻ cảnh báo màu đỏ, đồng thời **vô hiệu hóa nút bấm xác nhận (disabled)**.
2. **Chặn Lệch Loại Tiền Tệ (Currency Parity Guard)**:
   - Backend: Kiểm tra `(debts[0].currency || 'VND').toUpperCase()` -> quăng lỗi `Chỉ có thể gộp các khoản nợ có cùng đơn vị tiền tệ` (ngăn chặn việc cộng dồn sai lệch USD với VND).
   - Backend `combineContacts`: Tự động nhóm các khoản nợ theo cả **Chiều nợ (receivable / payable)** và **Loại tiền tệ (VND, USD...)** trước khi gộp tự động, đảm bảo không bao giờ bị lỗi khi gộp liên hệ có nhiều loại tiền.
   - Frontend `CombineDebtsDialog`: Hiển thị cảnh báo `Chỉ có thể gộp các khoản nợ có cùng loại tiền tệ` và disable nút submit.
3. **Chặn Cây Phân Cấp Lồng Đa Tầng / Vòng Lặp (Cyclic & Multi-Tier Hierarchy Guard)**:
   - Khi gộp một khoản nợ đã từng là nợ cha (có `children`), toàn bộ các khoản nợ con cũ được tự động nâng cấp/liên kết trực tiếp lên khoản nợ cha mới (`savedParent.id`), triệt tiêu hoàn toàn hiện tượng cây phân cấp vô tận hoặc đệ quy vô hạn.
4. **Kiểm Tra Quyền Sở Hữu & Số Lượng Tối Thiểu (Ownership & Minimum Quantity Guard)**:
   - Yêu cầu ít nhất 2 ID duy nhất (`uniqueIds.length >= 2`).
   - Đảm bảo tất cả các khoản nợ được chọn đều tồn tại và thuộc quyền sở hữu của chính user (`debts.length === uniqueIds.length`).
5. **Xử Lý Ngày Tháng An Toàn (Safe Date Parsing)**:
   - Chuẩn hóa `dueAt` và `occurredAt` với `Number.isNaN(parsed.getTime())` fallback, tránh lỗi crash database do date string không hợp lệ.

---

## 3. Các Thay Đổi Đã Thực Hiện

### 3.1. Shared Contracts (`packages/contracts`)

- Thêm endpoint `API_ROUTES.debtsCombine = '/api/debts/combine'`.
- Thêm DTOs: `ICombineDebtsRequest`, `ICombineDebtsResponse`, mở rộng `ICombineContactsRequest` (`consolidateDebts?: boolean`), mở rộng `IDebtListItem` (`parentDebtId?: string | null`, `children?: IDebtListItem[]`, `childCount?: number`).
- Bổ sung bộ từ điển song ngữ (`vi` và `en`): `debts.actions.combine`, `debts.combineModal.*` (kèm `mismatchedDirection`, `mismatchedCurrency`), `debts.badge.parent`, `debts.badge.child`, `debts.expandChildren`, `debts.collapseChildren`, `debts.selectedCount`, `contacts.combineModal.consolidateDebts`.

### 3.2. Database & Migration

- **Entity**: `DebtEntity` (`apps/api/src/database/entities/debt.entity.ts`) bổ sung trường `parentDebtId` với quan hệ tự tham chiếu `@ManyToOne` và `@OneToMany` (`children`).
- **Migration**: `1724680000000-AddParentDebtHierarchy.ts` bổ sung cột `parent_debt_id`, ràng buộc khóa ngoại `FK_debts_parent_debt_id` (với `ON DELETE SET NULL`) và chỉ mục `IDX_debts_parent_debt_id`. Đã đăng ký vào `DatabaseModule` và `data-source.ts`.

### 3.3. Backend NestJS

- **`FinanceService`**:
  - Thêm phương thức `combineDebts(userId, input: CombineDebtsDto)` chạy trong transaction nguyên tử (`manager.transaction`), kiểm tra tính đồng nhất về chiều (`direction`) và loại tiền tệ (`currency`), tính tổng số tiền gốc và số tiền còn lại, tạo bản ghi nợ cha và cập nhật `parentDebtId` cho các khoản con.
  - Cập nhật `combineContacts` hỗ trợ cờ `consolidateDebts: true` tự động gom nợ an toàn theo chiều và tiền tệ.
  - Cập nhật `listDebts` và `getDebt` nạp quan hệ `children` và `parentDebt`.
- **`FinanceController`**: Thêm endpoint `POST /api/debts/combine`.
- **`ReportsController`**: Hàm `mapDebt` ánh xạ cấu trúc cây phân cấp `children`, `childCount`, `parentDebtId` cho API báo cáo / Web dashboard.
- **Unit Tests**: 70 unit tests backend vượt qua 100%, bao gồm các test case kiểm tra từ chối khi lệch chiều, lệch tiền tệ, và ít hơn 2 khoản nợ.

### 3.4. Frontend Web (Next.js & Tailwind CSS)

- **API & TanStack Query**: Thêm `combineDebts` trong `debts-api.ts` và hook `useCombineDebtsMutation` trong `debts-query.ts`.
- **`CombineDebtsDialog`**: Modal chọn ghi chú nợ cha, ngày đến hạn nợ cha, hiển thị bảng tóm tắt các khoản nợ được chọn, tổng tiền gốc & còn lại, cảnh báo nếu lệch chiều nợ hoặc lệch loại tiền tệ.
- **`DebtsTable`**: Bổ sung cột checkbox chọn nhiều dòng, nút mở rộng/thu gọn cây nợ con (`▶ / ▼`), render thụt lề cho các khoản con kèm huy hiệu `[Khoản con]` và `[Gộp: N khoản con]`.
- **`DebtsScreen`**: Thanh toolbar chọn nhiều dòng, hiển thị nút `Gộp khoản nợ ({count})` khi chọn $\ge 2$ dòng, mở dialog gộp nợ.
- **`CombineContactsDialog`**: Bổ sung checkbox `consolidateDebts` ("Tự động gộp các khoản nợ cùng chiều thành 1 khoản tổng").

---

## 4. Kết Quả Kiểm Thử & Đảm Bảo Chất Lượng (Quality Gates)

| Lệnh kiểm thử                                                   | Kết quả   | Chi tiết                                                                                      |
| :-------------------------------------------------------------- | :-------- | :-------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                             | ✅ PASSED | 0 lỗi TypeScript trên toàn bộ monorepo (`@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`) |
| `npm run test --workspace=@zalobot/api`                         | ✅ PASSED | 70/70 backend unit tests pass 100%                                                            |
| `npm run build --workspace=@zalobot/web`                        | ✅ PASSED | Build thành công 19 static routes Next.js                                                     |
| `npm run lint`                                                  | ✅ PASSED | Tuân thủ 100% quy chuẩn ESLint và Prettier                                                    |
| `npm run agent-system:validate -- --check-changes --check-i18n` | ✅ PASSED | 91 artifacts, 157 dependencies, 0 drift, 0 lỗi i18n                                           |
