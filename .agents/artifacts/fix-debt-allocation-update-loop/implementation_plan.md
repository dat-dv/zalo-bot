# Kế hoạch sửa vòng lặp cập nhật DebtAllocationModal

RequestFeedback: true

## Phạm vi

- `apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`
- Bổ sung kiểm thử hồi quy ở seam UI hiện có, nếu cấu hình kiểm thử của `apps/web` hỗ trợ.

## Bằng chứng và nguyên nhân gốc

1. `DebtAllocationModal` luôn được mount từ `TransactionsScreen`, kể cả khi đóng (`isOpen=false`, `transaction=null`).
2. Hai query bị vô hiệu khi không có `transactionId`, nên `data` là `undefined` trong giai đoạn đó.
3. Destructuring `data: existingAllocations = []` tạo một mảng rỗng mới trong từng render. `existingAllocations` nằm trong dependency của effect khởi tạo draft.
4. Effect chạy lại và gọi các setter với `new Set()` cùng object mới, tạo render kế tiếp; dependency tiếp tục đổi nên React báo `Maximum update depth exceeded` tại dòng `setSelectedDebtIds(new Set())`.

## Thay đổi đề xuất

1. Dùng một mảng rỗng có tham chiếu ổn định cho dữ liệu query chưa có (không dùng literal `[]` trong destructuring render), để dependency `existingAllocations` không đổi chỉ vì modal đang đóng.
2. Giữ nguyên logic khởi tạo draft khi mở modal, đổi giao dịch, hoặc nhận allocations thật từ server; chỉ chặn re-render giả khi query chưa có dữ liệu.
3. Thêm/điều chỉnh kiểm thử hồi quy nếu test runner khả dụng: render `TransactionsScreen`/modal trong trạng thái đóng và xác nhận không phát sinh lỗi update depth; mở modal với allocations có sẵn vẫn khởi tạo đúng selection, amount và note.

## Xác minh sau khi thực hiện

1. Chạy kiểm thử hồi quy mới (hoặc harness component tương đương) để xác nhận trạng thái đóng không lặp render.
2. Chạy `npm run lint --workspace @zalobot/web` và `npm run typecheck --workspace @zalobot/web`.
3. Kiểm tra thủ công: mở modal từ một giao dịch, đóng bằng nút/Escape, rồi mở lại; không có console error và dữ liệu allocation cũ vẫn hiển thị đúng.

## Rủi ro và rollback

Rủi ro thấp, giới hạn trong trạng thái tạm của modal; không đổi API, dữ liệu hoặc quy tắc phân bổ. Có thể rollback bằng hoàn tác thay đổi component và kiểm thử tương ứng.
