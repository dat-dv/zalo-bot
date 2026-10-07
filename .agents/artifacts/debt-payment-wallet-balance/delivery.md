# Bàn giao: đồng bộ thanh toán công nợ với số dư ví

## Đã thực hiện

- Mỗi lần ghi nhận thanh toán công nợ nay được xử lý trong một database transaction.
- Khoản phải thu (`receivable`) tạo giao dịch `income` thuộc danh mục `Thu hồi nợ`, nên số dư ví tăng.
- Khoản phải trả (`payable`) tạo giao dịch `expense` thuộc danh mục `Trả nợ`, nên số dư ví giảm.
- Giao dịch ví dùng đúng số tiền, tiền tệ, ngày thanh toán và liên hệ của khoản công nợ.

## Kiểm chứng

- `npm run test --workspace @zalobot/api -- src/finance/finance.service.spec.ts` — đạt 51/51 kiểm thử.
- `npm run typecheck` — đạt.
- `npm run lint` — đạt.
- `git diff --check` — đạt.

## Giới hạn chủ động

Thay đổi chỉ áp dụng cho các lần ghi nhận thanh toán mới; không tự tạo giao dịch thu/chi hồi tố cho lịch sử cũ.
