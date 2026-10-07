# Kế hoạch chuẩn hóa định dạng Thẻ Xác Nhận và Kết Quả Ghi Nợ / Cho Vay trên zalo

## Bối cảnh & Vấn đề

Khi người dùng gửi yêu cầu liên quan đến vay mượn tiền (ví dụ: _"cho bạn trí mượn 500k chưa trả"_), hệ thống AI gọi công cụ `create_debt`.
Tuy nhiên:

1. **Hộp thoại xác nhận (`formatConfirmationBox`)**: Chưa có bộ định dạng riêng cho `create_debt`, `record_debt_payment`, `update_debt_contact`, dẫn đến việc fallback hiển thị JSON kỹ thuật thô (`<pre>JSON</pre>`).
2. **Hộp thoại kết quả (`formatResultBox`)**: Sau khi người dùng bấm **✅ Xác nhận**, kết quả trả về không có trường `message` nên rơi vào fallback mặc định `✅ Đã thực hiện thao tác.` thay vì hiển thị chi tiết khoản nợ vừa ghi (người vay/cho vay, số tiền, ghi chú, hạn trả).

## Các Thay Đổi Đề Xuất

### 1. `apps/api/src/zalo/services/zalo-ui.service.ts`

- **Thẻ xác nhận ghi nợ / cho vay (`create_debt`)**:
  - Phân biệt rõ chiều công nợ: `Cho vay (Người khác nợ bạn)` (khi `direction === 'receivable'`) vs `Đi vay (Bạn nợ người khác)` (khi `direction === 'payable'`).
  - Hiển thị đối tác (`counterparty`), biệt danh (`counterpartyAlias`), số tiền đã format VND (`formatMoney(amount)`), ghi chú (`note`), hạn trả (`dueAt`).
  - Nếu `createNewContact: true`, bổ sung dòng thông báo danh bạ: `🆕 Danh bạ: Thêm người mới vào danh bạ`.
  - Giữ khối thông tin gọn gàng, có mã xác nhận `Mã: REQ-XXXXXX` và hướng dẫn bấm Xác nhận.

- **Thẻ kết quả ghi nợ (`create_debt`)**:
  - Hiển thị: `✅ <b>Đã ghi khoản cho vay</b> · [Tên đối tác] ([Biệt danh]) · [Số tiền VND] · [Ghi chú]`.
  - Hoặc: `✅ <b>Đã ghi khoản vay</b> · [Tên đối tác] ([Biệt danh]) · [Số tiền VND] · [Ghi chú]`.

- **Thẻ xác nhận & kết quả trả nợ (`record_debt_payment`)**:
  - Xác nhận: Số tiền trả, mã khoản nợ/đối tác.
  - Kết quả: `✅ <b>Đã ghi nhận trả nợ</b> · [Tên đối tác] · [Đã tất toán / Còn lại: X đ]`.

- **Thẻ xác nhận & kết quả danh bạ nợ (`update_debt_contact`)**:
  - Xác nhận: Tên mới, biệt danh mới.
  - Kết quả: `✅ <b>Đã cập nhật danh bạ</b> · [Tên] ([Biệt danh])`.

- **Chuẩn hóa các công cụ confirmation còn lại**:
  - Bổ sung định dạng đẹp mắt, loại bỏ hoàn toàn JSON thô cho `delete_debt`, `create_calendar_event`, `create_reminder`, `complete_task`, `delete_calendar_event`, `delete_reminder`, `create_invite_link`, `ban_user`.

### 2. `apps/api/src/gemini/helpers/gemini-prompt.helper.ts`

- Thêm mẫu định dạng `e. THẺ XÁC NHẬN CÔNG NỢ (create_debt, record_debt_payment)` vào system instruction để đảm bảo Gemini hiểu và sinh phản hồi tự nhiên đồng bộ.

### 3. `apps/api/src/zalo/services/zalo-ui.service.spec.ts`

- Viết test suites kiểm thử:
  - `create_debt` confirmation box (chiều receivable & payable, có alias, có note, có due date).
  - `create_debt` result box.
  - `record_debt_payment` confirmation & result box.
  - `update_debt_contact` confirmation & result box.

### 4. Đồng bộ Tài liệu

- Cập nhật `.agents/knowledge/global/zalo-response-layout.md` và `.agents/docs/global/zalo-response-layout.md`.

---

## Kế Hoạch Xác Minh (Verification Plan)

### Kiểm thử Tự Động (Automated Tests)

1. Chạy test suite của UI service:
   ```bash
   npx tsx --test apps/api/src/zalo/services/zalo-ui.service.spec.ts
   ```
2. Chạy toàn bộ test của API workspace:
   ```bash
   npm run test --workspace @zalobot/api
   ```
3. Chạy typecheck và linter:
   ```bash
   npm run typecheck
   npm run lint
   npm run agent-system:validate
   ```

### Xác minh Thủ công

- Kiểm tra các mẫu đầu ra của `formatConfirmationBox('create_debt', ...)` và `formatResultBox('create_debt', ...)`.
