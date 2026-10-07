# Kế hoạch triển khai: Gắn thu/chi vào khoản công nợ

RequestFeedback: true

## Mục tiêu đã hiểu

Khi một khoản thu hoặc chi liên quan công nợ được ghi nhận, người dùng có thể **chủ động chọn** một hay nhiều khoản công nợ phù hợp để phân bổ số tiền đó. Giao diện dùng checkbox để chọn các khoản và hiển thị tổng tiền đã phân bổ/còn chưa phân bổ. Mỗi khoản được chọn sẽ tự cập nhật số còn lại và trạng thái.

Ví dụ: chọn giao dịch thu `Trí trả 5.000.000đ`; giao diện chỉ mở các khoản **phải thu đang mở** của Trí. Người dùng tick một hoặc nhiều khoản, nhập mức phân bổ từng khoản, rồi xác nhận. Không bắt buộc phải phân bổ hết 5.000.000đ.

## Quyết định thiết kế

### 1. `category` chỉ là tín hiệu, không phải khóa liên kết

Agent cần gán category chuẩn để định hướng luồng:

| Chiều giao dịch | Loại công nợ                   | Category đề xuất  |
| --------------- | ------------------------------ | ----------------- |
| Thu tiền        | Khoản phải thu được hoàn       | `Thu hồi công nợ` |
| Chi tiền        | Khoản phải trả được thanh toán | `Trả công nợ`     |

Tuy nhiên, **không dùng category để quyết định khoản nợ nào**: một người có thể có nhiều khoản cùng category. Liên kết chính xác phải nằm ở dữ liệu phân bổ bằng ID.

### 2. Tạo thực thể phân bổ thay cho việc chỉ nối một-một

Thêm bảng/entity `debt_payment_allocations`:

- `id`, `user_id`
- `finance_transaction_id`: giao dịch thu/chi nguồn
- `debt_id`: khoản công nợ được áp vào
- `amount`: số tiền phân bổ dương
- `allocated_at`, `note`, `created_at`

Ràng buộc nghiệp vụ:

- Giao dịch `income` chỉ phân bổ vào `receivable`; `expense` chỉ vào `payable`.
- Cùng `user_id`, cùng tiền tệ và (khi cả hai có) cùng `contact_id`.
- Mỗi allocation lớn hơn 0; tổng allocation của transaction không vượt `transaction.amount`.
- Tổng allocation của debt không vượt `remaining_amount` tại thời điểm ghi.
- Mọi ghi allocation, cập nhật `remainingAmount`, và tạo lịch sử trả nợ diễn ra trong một database transaction.

`DebtPaymentEntity` hiện hữu trở thành lịch sử thanh toán theo khoản nợ, được tạo từ allocation; bổ sung `financeTransactionId` (nullable trước khi chuyển dữ liệu) để truy ngược giao dịch nguồn. Không tạo thêm một giao dịch thu/chi khi allocation đã bắt đầu từ giao dịch có sẵn.

### 3. Trạng thái công nợ

Giữ trạng thái ở mức khoản nợ, không tạo status cho category:

- `active`: còn tiền, chưa quá hạn hoặc không có hạn.
- `partial`: còn tiền và đã có ít nhất một thanh toán. (Cần bổ sung enum/label.)
- `overdue`: còn tiền và đã qua `dueAt`. Đây là trạng thái tính theo thời gian khi đọc, không cần ghi đè mất trạng thái thanh toán.
- `settled`: `remainingAmount = 0`, có `settledAt`.

Nguồn sự thật vẫn là `remainingAmount` và lịch sử allocation/payment. Status chỉ là trạng thái hiển thị/tìm kiếm được suy ra hoặc đồng bộ theo các quy tắc trên.

## Phạm vi thay đổi dự kiến

1. **Database & backend finance**
   - Thêm entity/migration cho allocation và liên kết transaction ↔ debt payment.
   - Bổ sung quan hệ trong `FinanceTransactionEntity`, `DebtEntity`, `DebtPaymentEntity` và đăng ký entity trong module.
   - Tạo use case/service `allocateTransactionToDebts` nhận `transactionId` + danh sách `{ debtId, amount }`; khóa/kiểm tra các bản ghi liên quan, rồi cập nhật atomically.
   - Bổ sung endpoint để xem candidate debts theo transaction và endpoint tạo/cập nhật/xóa allocation (xóa phải hoàn lại số dư công nợ an toàn).
   - Mở rộng response chi tiết giao dịch và chi tiết công nợ để trả về allocation/history có liên kết.

2. **Contracts dùng chung**
   - Khai báo `IDebtAllocationItem`, candidate debt, request/response phân bổ và status mới.
   - Bổ sung đường dẫn API và chuỗi giao diện tiếng Việt/Anh cho `Thu hồi công nợ`, `Chưa phân bổ`, `Phân bổ vào khoản công nợ`, `Đã tất toán`, lỗi vượt số dư/vượt số tiền.

3. **Giao diện web**
   - Tại chi tiết hoặc form giao dịch, thêm nút `Phân bổ công nợ` chỉ khi giao dịch có contact và đúng chiều.
   - Sheet/modal hiển thị các khoản mở theo contact + direction bằng checkbox; mỗi hàng gồm ngày, ghi chú, số gốc, số còn lại, trạng thái, và ô số tiền áp vào.
   - Tổng hợp cố định: `Số giao dịch`, `Đã phân bổ`, `Còn chưa phân bổ`; vô hiệu hóa xác nhận khi tổng vượt giao dịch hoặc một hàng vượt số dư.
   - Khi xác nhận thành công, làm mới danh sách giao dịch, chi tiết khoản công nợ và các số liệu dashboard/analytics.

4. **Agent zalo/Gemini**
   - Bổ sung tool tìm khoản công nợ ứng viên theo `contact + direction + trạng thái mở` và tool phân bổ vào giao dịch/khoản nợ.
   - Với một ứng viên duy nhất: agent có thể đề xuất hoặc ghi nhận theo xác nhận hiện hành.
   - Với nhiều ứng viên: agent phải trả danh sách gồm ngày, ghi chú, số còn lại và hỏi người dùng chọn; không suy đoán chỉ từ category.
   - Khi agent tạo mới thu/chi có ngữ nghĩa trả nợ, nó gắn `contactId` và category chuẩn; sau đó thực hiện allocation chỉ khi xác định được debtId hoặc người dùng xác nhận.

5. **Tài liệu**
   - Cập nhật knowledge tiếng Anh và developer docs tiếng Việt cho module finance/debts cùng index `.agents/docs/README.md`, mô tả quy tắc allocation và trạng thái.

## Trải nghiệm mong muốn

```text
Giao dịch: Trí trả 5.000.000đ  [Thu hồi công nợ]
     │
     └─ Phân bổ công nợ
          ☑ Trí — 12/08 — Mượn mua xe — còn 3.000.000đ  [3.000.000]
          ☑ Trí — 20/08 — Mượn tiền mặt — còn 4.000.000đ [2.000.000]

          Đã phân bổ: 5.000.000đ / Giao dịch: 5.000.000đ
          → Khoản 1: settled; khoản 2: partial, còn 2.000.000đ
```

## Kiểm thử và xác minh

- Unit test service: chiều thu/chi sai, khác user/contact/currency, vượt số tiền giao dịch, vượt số dư khoản nợ, phân bổ nhiều khoản, rollback khi một mục không hợp lệ, xóa allocation hoàn số dư.
- API test: candidate filtering, authorization theo `user_id`, chi tiết lịch sử có truy vết transaction.
- UI test: checkbox, tổng tiền, validation theo thời gian thực, làm mới dữ liệu sau mutation.
- Chạy `npm run lint`, `npm run test`, `npm run typecheck`, và kiểm tra migration trên database phát triển.

## Rủi ro và cách kiểm soát

- Đây là thay đổi schema và API đa tầng, cần migration có thể rollback; không thay đổi/xóa lịch sử payment cũ trong lần đầu.
- Không tự động gán các transaction lịch sử vào debt: chỉ hỗ trợ phân bổ thủ công hoặc theo xác nhận, tránh làm sai sổ.
- Cần đồng ý về nghĩa của `partial` và `overdue`: kế hoạch đề xuất `overdue` là trạng thái dẫn xuất theo hạn, không phải status lưu độc lập.

## Tiêu chí hoàn thành

- Một giao dịch có thể được phân bổ vào nhiều khoản công nợ, theo đúng chiều và người liên quan.
- Một khoản công nợ có lịch sử thu/trả truy ngược được về giao dịch gốc.
- UI cho phép chọn/gom rõ ràng, không thể phân bổ vượt mức.
- Agent có category nhất quán nhưng chỉ phân bổ sau khi xác định được khoản bằng ID hoặc được người dùng chọn.
